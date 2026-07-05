import sys
import os
import json

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../../Desktop/CAPSTONE/backend')))

if os.path.exists("database.db"):
    try:
        os.remove("database.db")
    except Exception as e:
        print(f"Could not remove database.db: {e}")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_flow():
    import random
    test_email = f"teststudent_{random.randint(100000, 999999)}@capstone.edu"
    print(f"Testing registration with email {test_email}...")
    reg_response = client.post("/api/auth/register", json={
        "email": test_email,
        "password": "securepassword123"
    })
    print("Register response:", reg_response.status_code, reg_response.json())
    assert reg_response.status_code == 200
    token = reg_response.json()["token"]
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Save Profile & Generate Syllabus
    print("\nTesting profile save...")
    prof_response = client.post("/api/profile", json={
        "name": "Alex Student",
        "country": "India",
        "board": "CBSE",
        "grade_class": "12th Grade",
        "stream": "Science",
        "subjects": ["Mathematics", "Physics"]
    }, headers=headers)
    print("Profile save response:", prof_response.status_code, prof_response.json())
    assert prof_response.status_code == 200
    
    # 3. Get Profile
    print("\nTesting profile fetch...")
    get_prof_response = client.get("/api/profile", headers=headers)
    print("Profile fetch response:", get_prof_response.status_code, get_prof_response.json())
    assert get_prof_response.status_code == 200
    
    # 4. Get Syllabus
    print("\nTesting syllabus fetch...")
    syll_response = client.get("/api/syllabus", headers=headers)
    print("Syllabus fetch response:", syll_response.status_code, len(syll_response.json()))
    assert syll_response.status_code == 200
    syllabi = syll_response.json()
    assert len(syllabi) == 2
    
    math_syll = syllabi[0]
    physics_syll = syllabi[1]
    
    print("Math chapters:", [ch["name"] for ch in math_syll["chapters"]])
    
    # 5. Get Materials for chapter 1 of Math
    ch1_id = math_syll["chapters"][0]["id"]
    ch1_name = math_syll["chapters"][0]["name"]
    print(f"\nTesting study materials generation for {ch1_name} ({ch1_id})...")
    mat_response = client.get(
        f"/api/materials/{ch1_id}?subject=Mathematics&chapter_name={ch1_name}",
        headers=headers
    )
    print("Materials response status:", mat_response.status_code)
    mat_data = mat_response.json()
    print("Has notes:", bool(mat_data.get("notes")))
    print("Flashcard count:", len(mat_data.get("flashcards", [])))
    print("Question count:", len(mat_data.get("important_questions", [])))
    
    # 6. Get Quiz for chapter 1 of Physics
    ch1_phys_id = physics_syll["chapters"][0]["id"]
    ch1_phys_name = physics_syll["chapters"][0]["name"]
    print(f"\nTesting quiz generation for {ch1_phys_name}...")
    quiz_response = client.get(
        f"/api/quiz/{ch1_phys_id}?subject=Physics&chapter_name={ch1_phys_name}",
        headers=headers
    )
    print("Quiz response status:", quiz_response.status_code)
    quiz_data = quiz_response.json()
    print("Quiz questions count:", len(quiz_data.get("questions", [])))
    
    # 7. Submit Quiz Attempt
    print("\nTesting quiz submission...")
    attempt_response = client.post(
        f"/api/quiz/{ch1_phys_id}/attempt",
        json={
            "subject": "Physics",
            "chapter_name": ch1_phys_name,
            "answers": [1, 1, 1, 0, 2] # Some mock answers
        },
        headers=headers
    )
    print("Quiz attempt response:", attempt_response.status_code, attempt_response.json())
    assert attempt_response.status_code == 200
    
    # 8. Get Planner
    print("\nTesting planner get...")
    planner_response = client.get("/api/planner", headers=headers)
    print("Planner response status:", planner_response.status_code)
    planner_data = planner_response.json()
    print("Planner routine blocks:", len(planner_data["daily_routine"]["blocks"]))
    
    # 9. Test Generate Study Schedule
    print("\nTesting generate AI study schedule...")
    sched_response = client.post(
        "/api/planner/generate_schedule",
        json={"datesheet_text": "Mathematics: 2026-07-20\nPhysics: 2026-07-25"},
        headers=headers
    )
    print("Generate schedule status:", sched_response.status_code)
    assert sched_response.status_code == 200
    sched_data = sched_response.json()
    print("Generated study schedule tasks:", len(sched_data.get("study_schedule", [])))
    print("Exam schedule mapping:", sched_data.get("exam_schedule"))
    
    # Clean up test SQLite database
    print("\nTest completed successfully!")

if __name__ == "__main__":
    test_flow()
