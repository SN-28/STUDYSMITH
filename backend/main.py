import os
import json
import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
import jwt
import bcrypt

from database import engine, Base, get_db
import models
import gemini_agent

# Initialize Database Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Personalized Learning Platform API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development purposes. In production, specify frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Secret and Configurations
JWT_SECRET = os.environ.get("JWT_SECRET", "super_secret_key_capstone_2026")
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# Pydantic Schemas for Requests & Responses
class UserRegister(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    email: str

class ProfileCreateUpdate(BaseModel):
    name: str
    country: str
    board: str
    grade_class: str
    stream: Optional[str] = None
    subjects: List[str]

class SyllabusUpdate(BaseModel):
    chapters: List[dict]

class QuizAttemptSubmit(BaseModel):
    subject: str
    chapter_name: str
    answers: List[int]  # List of selected option indices

class PlannerUpdate(BaseModel):
    exam_schedule: Optional[dict] = None
    daily_routine: Optional[dict] = None
    study_schedule: Optional[list] = None
    daily_progress: Optional[dict] = None
    reminders_enabled: Optional[bool] = None

# Helper Functions
def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# --- AUTH ENDPOINTS ---

@app.post("/api/auth/register", response_model=TokenResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user_data.password)
    new_user = models.User(email=user_data.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token({"sub": new_user.email})
    return {"token": token, "email": new_user.email}

@app.post("/api/auth/login", response_model=TokenResponse)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if not db_user or not verify_password(user_data.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    token = create_access_token({"sub": db_user.email})
    return {"token": token, "email": db_user.email}


# --- PROFILE ENDPOINTS ---

@app.get("/api/profile")
def get_profile(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    if not profile:
        return None
    return {
        "name": profile.name,
        "country": profile.country,
        "board": profile.board,
        "grade_class": profile.grade_class,
        "stream": profile.stream,
        "subjects": json.loads(profile.subjects)
    }

@app.post("/api/profile")
def save_profile(profile_data: ProfileCreateUpdate, generate_syllabi: bool = True, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    subjects_json = json.dumps(profile_data.subjects)
    
    if profile:
        profile.name = profile_data.name
        profile.country = profile_data.country
        profile.board = profile_data.board
        profile.grade_class = profile_data.grade_class
        profile.stream = profile_data.stream
        profile.subjects = subjects_json
    else:
        profile = models.Profile(
            user_id=current_user.id,
            name=profile_data.name,
            country=profile_data.country,
            board=profile_data.board,
            grade_class=profile_data.grade_class,
            stream=profile_data.stream,
            subjects=subjects_json
        )
        db.add(profile)
    
    db.commit()
    
    # Automatically generate structured syllabus for each selected subject if not already generated
    if generate_syllabi:
        for subject in profile_data.subjects:
            existing_syllabus = db.query(models.Syllabus).filter(
                models.Syllabus.user_id == current_user.id,
                models.Syllabus.subject == subject
            ).first()
            
            if not existing_syllabus:
                syllabus_data = gemini_agent.generate_syllabus(
                    subject=subject,
                    board=profile_data.board,
                    grade_class=profile_data.grade_class,
                    stream=profile_data.stream
                )
                new_syllabus = models.Syllabus(
                    user_id=current_user.id,
                    subject=subject,
                    chapters=json.dumps(syllabus_data.get("chapters", []))
                )
                db.add(new_syllabus)
                
        db.commit()
        
        # Automatically generate default regular study schedule if study_schedule is empty
        planner = db.query(models.Planner).filter(models.Planner.user_id == current_user.id).first()
        if not planner:
            planner = models.Planner(
                user_id=current_user.id,
                exam_schedule=json.dumps({}),
                daily_routine=json.dumps({
                    "wake_up": "07:00",
                    "blocks": [
                        {"start": "09:00", "end": "11:00", "activity": "Morning Study Block"},
                        {"start": "11:00", "end": "11:15", "activity": "Short Break"},
                        {"start": "14:00", "end": "16:00", "activity": "Afternoon Study Block"},
                        {"start": "16:00", "end": "16:30", "activity": "Long Break / Hydration"},
                        {"start": "19:00", "end": "21:00", "activity": "Evening Revision Block"}
                    ]
                }),
                study_schedule=json.dumps([]),
                daily_progress=json.dumps({}),
                reminders_enabled=True
            )
            db.add(planner)
            db.commit()
            db.refresh(planner)
            
        study_sched = json.loads(planner.study_schedule) if planner.study_schedule else []
        exam_sched = json.loads(planner.exam_schedule) if planner.exam_schedule else {}
        if not exam_sched:
            syllabi = db.query(models.Syllabus).filter(models.Syllabus.user_id == current_user.id).all()
            syllabi_list = []
            for s in syllabi:
                syllabi_list.append({
                    "subject": s.subject,
                    "chapters": json.loads(s.chapters)
                })
            result = gemini_agent.generate_study_schedule("", syllabi_list)
            planner.study_schedule = json.dumps(result.get("schedule", []))
            db.commit()

    return {"message": "Profile saved and syllabus generated successfully"}


# --- SYLLABUS ENDPOINTS ---

@app.get("/api/syllabus")
def get_syllabi(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    syllabi = db.query(models.Syllabus).filter(models.Syllabus.user_id == current_user.id).all()
    results = []
    for s in syllabi:
        results.append({
            "id": s.id,
            "subject": s.subject,
            "chapters": json.loads(s.chapters)
        })
    return results

@app.put("/api/syllabus/{syllabus_id}")
def update_syllabus(syllabus_id: int, payload: SyllabusUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    syllabus = db.query(models.Syllabus).filter(
        models.Syllabus.id == syllabus_id,
        models.Syllabus.user_id == current_user.id
    ).first()
    if not syllabus:
        raise HTTPException(status_code=404, detail="Syllabus not found")
        
    syllabus.chapters = json.dumps(payload.chapters)
    db.commit()
    return {"message": "Syllabus updated successfully"}

@app.post("/api/syllabus/{subject}/regenerate")
def regenerate_syllabus(subject: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Fetch user's profile
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile not set")
        
    # Delete existing syllabus for this subject
    db.query(models.Syllabus).filter(
        models.Syllabus.user_id == current_user.id,
        models.Syllabus.subject == subject
    ).delete()
    db.commit()
    
    # Generate a fresh one using the latest gemini_agent rules
    syllabus_data = gemini_agent.generate_syllabus(
        subject=subject,
        board=profile.board,
        grade_class=profile.grade_class,
        stream=profile.stream
    )
    new_syllabus = models.Syllabus(
        user_id=current_user.id,
        subject=subject,
        chapters=json.dumps(syllabus_data.get("chapters", []))
    )
    db.add(new_syllabus)
    db.commit()
    db.refresh(new_syllabus)
    
    return {
        "id": new_syllabus.id,
        "subject": new_syllabus.subject,
        "chapters": syllabus_data.get("chapters", [])
    }


# --- STUDY MATERIALS ENDPOINTS ---

@app.get("/api/materials/{chapter_id}")
def get_study_materials(chapter_id: str, subject: str, chapter_name: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    material = db.query(models.StudyMaterial).filter(
        models.StudyMaterial.user_id == current_user.id,
        models.StudyMaterial.subject == subject,
        models.StudyMaterial.chapter_id == chapter_id
    ).first()
    
    if not material:
        # Generate on-the-fly
        notes = gemini_agent.generate_chapter_material(chapter_name, subject, 'notes')
        short_notes = gemini_agent.generate_chapter_material(chapter_name, subject, 'short_notes')
        flashcards = gemini_agent.generate_chapter_material(chapter_name, subject, 'flashcards')
        important_questions = gemini_agent.generate_chapter_material(chapter_name, subject, 'important_questions')
        
        material = models.StudyMaterial(
            user_id=current_user.id,
            subject=subject,
            chapter_id=chapter_id,
            notes=notes,
            short_notes=short_notes,
            flashcards=flashcards,
            important_questions=important_questions
        )
        db.add(material)
        db.commit()
        db.refresh(material)
        
    return {
        "id": material.id,
        "subject": material.subject,
        "chapter_id": material.chapter_id,
        "notes": material.notes,
        "short_notes": material.short_notes,
        "flashcards": json.loads(material.flashcards) if material.flashcards else [],
        "important_questions": json.loads(material.important_questions) if material.important_questions else []
    }


# --- QUIZ ENDPOINTS ---

@app.get("/api/quiz/{chapter_id}")
def get_quiz(chapter_id: str, subject: str, chapter_name: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Quiz questions are shared for the same subject/chapter (not unique to user)
    quiz = db.query(models.Quiz).filter(
        models.Quiz.subject == subject,
        models.Quiz.chapter_id == chapter_id
    ).first()
    
    if not quiz:
        questions = gemini_agent.generate_quiz(chapter_name, subject)
        quiz = models.Quiz(
            subject=subject,
            chapter_id=chapter_id,
            questions=json.dumps(questions)
        )
        db.add(quiz)
        db.commit()
        db.refresh(quiz)
        
    return {
        "id": quiz.id,
        "subject": quiz.subject,
        "chapter_id": quiz.chapter_id,
        "questions": json.loads(quiz.questions)
    }

@app.post("/api/quiz/{chapter_id}/attempt")
def submit_quiz_attempt(chapter_id: str, attempt_data: QuizAttemptSubmit, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    quiz = db.query(models.Quiz).filter(
        models.Quiz.subject == attempt_data.subject,
        models.Quiz.chapter_id == chapter_id
    ).first()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    questions = json.loads(quiz.questions)
    evaluation = gemini_agent.evaluate_quiz_results(questions, attempt_data.answers)
    
    attempt = models.QuizAttempt(
        user_id=current_user.id,
        subject=attempt_data.subject,
        chapter_id=chapter_id,
        score=float(evaluation["score"]),
        total=evaluation["total"],
        weak_topics=json.dumps(evaluation["weak_topics"]),
        completed_at=datetime.datetime.utcnow()
    )
    db.add(attempt)
    db.commit()
    
    return {
        "score": attempt.score,
        "total": attempt.total,
        "weak_topics": evaluation["weak_topics"],
        "completed_at": attempt.completed_at
    }

@app.get("/api/quiz/attempts")
def get_quiz_attempts(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    attempts = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.user_id == current_user.id
    ).order_by(models.QuizAttempt.completed_at.desc()).all()
    
    results = []
    for a in attempts:
        results.append({
            "id": a.id,
            "subject": a.subject,
            "chapter_id": a.chapter_id,
            "score": a.score,
            "total": a.total,
            "weak_topics": json.loads(a.weak_topics) if a.weak_topics else [],
            "completed_at": a.completed_at
        })
    return results


# --- PLANNER ENDPOINTS ---

@app.get("/api/planner")
def get_planner(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    planner = db.query(models.Planner).filter(models.Planner.user_id == current_user.id).first()
    if not planner:
        # Create empty defaults
        planner = models.Planner(
            user_id=current_user.id,
            exam_schedule=json.dumps({}),
            daily_routine=json.dumps({
                "wake_up": "07:00",
                "blocks": [
                    {"start": "09:00", "end": "11:00", "activity": "Morning Study Block"},
                    {"start": "11:00", "end": "11:15", "activity": "Short Break"},
                    {"start": "14:00", "end": "16:00", "activity": "Afternoon Study Block"},
                    {"start": "16:00", "end": "16:30", "activity": "Long Break / Hydration"},
                    {"start": "19:00", "end": "21:00", "activity": "Evening Revision Block"}
                ]
            }),
            study_schedule=json.dumps([]),
            daily_progress=json.dumps({}),
            reminders_enabled=True
        )
        db.add(planner)
        db.commit()
        db.refresh(planner)
        
    study_sched = json.loads(planner.study_schedule) if planner.study_schedule else []
    if not study_sched:
        # Generate default general regular study schedule
        syllabi = db.query(models.Syllabus).filter(models.Syllabus.user_id == current_user.id).all()
        if syllabi:
            syllabi_list = []
            for s in syllabi:
                syllabi_list.append({
                    "subject": s.subject,
                    "chapters": json.loads(s.chapters)
                })
            result = gemini_agent.generate_study_schedule("", syllabi_list)
            planner.study_schedule = json.dumps(result.get("schedule", []))
            db.commit()
        
    return {
        "id": planner.id,
        "exam_schedule": json.loads(planner.exam_schedule) if planner.exam_schedule else {},
        "daily_routine": json.loads(planner.daily_routine) if planner.daily_routine else {},
        "study_schedule": json.loads(planner.study_schedule) if planner.study_schedule else [],
        "daily_progress": json.loads(planner.daily_progress) if planner.daily_progress else {},
        "reminders_enabled": planner.reminders_enabled
    }

@app.put("/api/planner")
def update_planner(payload: PlannerUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    planner = db.query(models.Planner).filter(models.Planner.user_id == current_user.id).first()
    if not planner:
        raise HTTPException(status_code=404, detail="Planner not found")
        
    if payload.exam_schedule is not None:
        planner.exam_schedule = json.dumps(payload.exam_schedule)
    if payload.daily_routine is not None:
        planner.daily_routine = json.dumps(payload.daily_routine)
    if payload.study_schedule is not None:
        planner.study_schedule = json.dumps(payload.study_schedule)
    if payload.daily_progress is not None:
        planner.daily_progress = json.dumps(payload.daily_progress)
    if payload.reminders_enabled is not None:
        planner.reminders_enabled = payload.reminders_enabled
        
    db.commit()
    return {"message": "Planner updated successfully"}


class GenerateScheduleRequest(BaseModel):
    datesheet_text: str

@app.post("/api/planner/generate_schedule")
def generate_planner_schedule(payload: GenerateScheduleRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    planner = db.query(models.Planner).filter(models.Planner.user_id == current_user.id).first()
    if not planner:
        raise HTTPException(status_code=404, detail="Planner not found")
        
    # Fetch user's syllabi
    syllabi = db.query(models.Syllabus).filter(models.Syllabus.user_id == current_user.id).all()
    syllabi_list = []
    for s in syllabi:
        syllabi_list.append({
            "subject": s.subject,
            "chapters": json.loads(s.chapters)
        })
        
    # Generate schedule using Gemini agent
    result = gemini_agent.generate_study_schedule(payload.datesheet_text, syllabi_list)
    schedule_tasks = result.get("schedule", [])
    
    planner.study_schedule = json.dumps(schedule_tasks)
    
    # Parse datesheet robustly using gemini_agent
    exam_schedule = gemini_agent.parse_datesheet(payload.datesheet_text)
            
    if exam_schedule:
        planner.exam_schedule = json.dumps(exam_schedule)
        
    db.commit()
    return {
        "message": "AI exam study schedule generated successfully",
        "study_schedule": schedule_tasks,
        "exam_schedule": exam_schedule
    }



# --- SERVE FRONTEND SPA ---
app.mount("/", StaticFiles(directory="static", html=True), name="static")
