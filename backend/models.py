import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    syllabi = relationship("Syllabus", back_populates="user", cascade="all, delete-orphan")
    materials = relationship("StudyMaterial", back_populates="user", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="user", cascade="all, delete-orphan")
    planner = relationship("Planner", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    country = Column(String, nullable=False)
    board = Column(String, nullable=False)
    grade_class = Column(String, nullable=False)
    stream = Column(String, nullable=True)
    subjects = Column(Text, nullable=False) # Store list of subjects as JSON string

    user = relationship("User", back_populates="profile")


class Syllabus(Base):
    __tablename__ = "syllabi"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    # Store list of chapters: [{"id": "ch1", "name": "...", "topics": ["..."], "order": 1}] as JSON
    chapters = Column(Text, nullable=False)

    user = relationship("User", back_populates="syllabi")


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    chapter_id = Column(String, nullable=False)
    notes = Column(Text, nullable=True) # Full notes in markdown
    short_notes = Column(Text, nullable=True) # Short revision notes in markdown
    flashcards = Column(Text, nullable=True) # JSON: [{"front": "...", "back": "..."}]
    important_questions = Column(Text, nullable=True) # JSON: [{"question": "...", "type": "important/practice", "guideline_answer": "..."}]

    user = relationship("User", back_populates="materials")


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, nullable=False)
    chapter_id = Column(String, nullable=False)
    questions = Column(Text, nullable=False) # JSON: [{"id": 1, "text": "...", "options": ["..."], "correct_option_index": 0, "explanation": "..."}]


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)
    chapter_id = Column(String, nullable=False)
    score = Column(Float, nullable=False)
    total = Column(Integer, nullable=False)
    weak_topics = Column(Text, nullable=True) # JSON array of string topics
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="attempts")


class Planner(Base):
    __tablename__ = "planners"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    # JSON: {"subject_name": "YYYY-MM-DD"}
    exam_schedule = Column(Text, nullable=True)
    # JSON: {"wake_up": "07:00", "blocks": [{"start": "09:00", "end": "11:00", "activity": "Study"}], ...}
    daily_routine = Column(Text, nullable=True)
    # JSON: [{"date": "YYYY-MM-DD", "subject": "Math", "chapter_id": "ch1", "duration_mins": 120, "completed": false}]
    study_schedule = Column(Text, nullable=True)
    # JSON: {"YYYY-MM-DD": {"completed_study_mins": 120, "water_intake_ml": 1500, "breaks_taken": 3}}
    daily_progress = Column(Text, nullable=True)
    reminders_enabled = Column(Boolean, default=True)

    user = relationship("User", back_populates="planner")
