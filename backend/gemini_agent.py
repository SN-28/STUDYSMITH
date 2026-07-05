import os
import json
from dotenv import load_dotenv
load_dotenv()

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

# Initialize Gemini Client if API key is provided
api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None

# Pydantic Schemas for Structured Output
class SyllabusChapter(BaseModel):
    id: str = Field(description="Unique short ID for the chapter, e.g., ch1, ch2")
    name: str = Field(description="Name of the chapter")
    topics: list[str] = Field(description="Key topics covered in this chapter")
    order: int = Field(description="Sequence/order of the chapter starting from 1")

class SyllabusResponse(BaseModel):
    chapters: list[SyllabusChapter]

class Flashcard(BaseModel):
    front: str = Field(description="Question or prompt on the front of the flashcard")
    back: str = Field(description="Answer or explanation on the back of the flashcard")

class FlashcardsResponse(BaseModel):
    flashcards: list[Flashcard]

class ImportantQuestion(BaseModel):
    question: str = Field(description="The question or problem statement")
    type: str = Field(description="Type of the question, either 'important' or 'practice'")
    guideline_answer: str = Field(description="A model guideline answer or solution outline")

class ImportantQuestionsResponse(BaseModel):
    questions: list[ImportantQuestion]

class QuizQuestion(BaseModel):
    id: int = Field(description="Question ID starting from 1")
    text: str = Field(description="The question text")
    options: list[str] = Field(description="Four distinct multiple-choice options")
    correct_option_index: int = Field(description="0-based index of the correct option")
    explanation: str = Field(description="Explanation of why this option is correct")

class QuizResponse(BaseModel):
    questions: list[QuizQuestion]

# --- Mock Data Generator (Fallback when API Key is missing) ---
def get_mock_syllabus(subject: str, board: str, grade_class: str, stream: str = None) -> dict:
    sub = subject.lower().strip()
    board_clean = board.strip().upper()
    grade_clean = grade_class.strip()
    
    # Extract numerical grade if possible (e.g., "12th Grade" -> 12, "Class 8" -> 8)
    import re
    grade_num = None
    match = re.search(r"(\d+)", grade_clean)
    if match:
        grade_num = int(match.group(1))
    else:
        # Fallback mappings for text grades
        gc_lower = grade_clean.lower()
        if "six" in gc_lower or "6" in gc_lower: grade_num = 6
        elif "seven" in gc_lower or "7" in gc_lower: grade_num = 7
        elif "eight" in gc_lower or "8" in gc_lower: grade_num = 8
        elif "nine" in gc_lower or "9" in gc_lower: grade_num = 9
        elif "ten" in gc_lower or "10" in gc_lower: grade_num = 10
        elif "eleven" in gc_lower or "11" in gc_lower: grade_num = 11
        elif "twelve" in gc_lower or "12" in gc_lower: grade_num = 12
        
    if not grade_num:
        grade_num = 10 # Default to grade 10 if we can't parse
        
    chapters = []
    
    # ------------------ MATHEMATICS ------------------
    if "math" in sub:
        if grade_num <= 8:
            chapters = [
                {"id": "ch1", "name": f"Number System & Integers ({board_clean})", "topics": ["Integers properties", "Fractions and decimals", "Rational numbers"], "order": 1},
                {"id": "ch2", "name": f"Simple Equations & Algebra ({board_clean})", "topics": ["Linear equations in one variable", "Algebraic expressions"], "order": 2},
                {"id": "ch3", "name": f"Practical Geometry ({board_clean})", "topics": ["Lines and angles", "Triangles and their properties", "Congruence of triangles"], "order": 3},
                {"id": "ch4", "name": f"Comparing Quantities ({board_clean})", "topics": ["Ratios and percentages", "Profit and loss", "Simple interest"], "order": 4},
                {"id": "ch5", "name": f"Perimeter & Area ({board_clean})", "topics": ["Squares and rectangles", "Area of triangles and parallelograms", "Circles"], "order": 5},
                {"id": "ch6", "name": f"Data Handling ({board_clean})", "topics": ["Mean, median, and mode", "Bar graphs", "Probability basics"], "order": 6}
            ]
        elif grade_num in [9, 10]:
            chapters = [
                {"id": "ch1", "name": f"Real Numbers & Polynomials ({board_clean})", "topics": ["Euclid's division lemma", "Fundamental theorem of arithmetic", "Zeroes of a polynomial"], "order": 1},
                {"id": "ch2", "name": f"Linear Equations in Two Variables ({board_clean})", "topics": ["Graphical method of solution", "Algebraic methods (Substitution, Elimination)", "Equations reducible to linear form"], "order": 2},
                {"id": "ch3", "name": f"Quadratic Equations & AP ({board_clean})", "topics": ["Standard form of quadratic equations", "Solution by factorization/formula", "Arithmetic Progressions basics"], "order": 3},
                {"id": "ch4", "name": f"Trigonometry & Applications ({board_clean})", "topics": ["Trigonometric ratios", "Ratios of complementary angles", "Heights and distances word problems"], "order": 4},
                {"id": "ch5", "name": f"Coordinate Geometry ({board_clean})", "topics": ["Distance formula", "Section formula", "Area of a triangle"], "order": 5},
                {"id": "ch6", "name": f"Circles & Areas Related ({board_clean})", "topics": ["Tangent to a circle", "Area of sectors and segments", "Perimeter of circular designs"], "order": 6},
                {"id": "ch7", "name": f"Probability & Statistics ({board_clean})", "topics": ["Mean, median, and mode of grouped data", "Cumulative frequency graphs", "Classical definition of probability"], "order": 7}
            ]
        else: # Grade 11 & 12
            chapters = [
                {"id": "ch1", "name": f"Relations, Functions & Inverse Trig ({board_clean})", "topics": ["Types of relations", "One-to-one and onto functions", "Principal value branches of inverse trig"], "order": 1},
                {"id": "ch2", "name": f"Matrices & Determinants ({board_clean})", "topics": ["Matrix operations", "Transpose and symmetric matrices", "Adjoint and inverse of matrices", "System of linear equations"], "order": 2},
                {"id": "ch3", "name": f"Continuity & Differentiability ({board_clean})", "topics": ["Continuity check", "Chain rule of differentiation", "Logarithmic and exponential derivatives"], "order": 3},
                {"id": "ch4", "name": f"Application of Derivatives ({board_clean})", "topics": ["Rate of change", "Increasing and decreasing functions", "Maxima and minima"], "order": 4},
                {"id": "ch5", "name": f"Integrals & Applications ({board_clean})", "topics": ["Methods of integration", "Definite integrals", "Area under simple curves"], "order": 5},
                {"id": "ch6", "name": f"Differential Equations ({board_clean})", "topics": ["Order and degree", "Homogeneous equations", "Linear differential equations"], "order": 6},
                {"id": "ch7", "name": f"Vector Algebra & 3D Geometry ({board_clean})", "topics": ["Scalar and vector products", "Direction cosines", "Line and plane equations in space"], "order": 7},
                {"id": "ch8", "name": f"Probability & Bayes' Theorem ({board_clean})", "topics": ["Conditional probability", "Independent events", "Bayes' Theorem", "Probability distributions"], "order": 8}
            ]

    # ------------------ PHYSICS ------------------
    elif "phys" in sub:
        if grade_num <= 8:
            chapters = [
                {"id": "ch1", "name": f"Force & Pressure ({board_clean})", "topics": ["Push and pull", "Contact and non-contact forces", "Atmospheric pressure"], "order": 1},
                {"id": "ch2", "name": f"Friction & Sound ({board_clean})", "topics": ["Factors affecting friction", "Fluid friction", "Production and propagation of sound"], "order": 2},
                {"id": "ch3", "name": f"Chemical Effects of Electric Current ({board_clean})", "topics": ["Conduction in liquids", "Electroplating applications"], "order": 3},
                {"id": "ch4", "name": f"Light & Reflection ({board_clean})", "topics": ["Laws of reflection", "Structure of human eye", "Multiple reflection and kaleidoscopes"], "order": 4}
            ]
        elif grade_num in [9, 10]:
            chapters = [
                {"id": "ch1", "name": f"Motion, Force & Laws ({board_clean})", "topics": ["Distance and displacement", "Equations of motion", "Newton's laws of motion"], "order": 1},
                {"id": "ch2", "name": f"Gravitation & Thrust ({board_clean})", "topics": ["Universal law of gravitation", "Acceleration due to gravity", "Buoyancy and Archimedes' principle"], "order": 2},
                {"id": "ch3", "name": f"Work, Energy & Power ({board_clean})", "topics": ["Kinetic and potential energy", "Law of conservation of energy", "Commercial unit of energy"], "order": 3},
                {"id": "ch4", "name": f"Light: Reflection & Refraction ({board_clean})", "topics": ["Spherical mirrors", "Refractive index", "Lens formula and magnification"], "order": 4},
                {"id": "ch5", "name": f"Electricity & Heating Effects ({board_clean})", "topics": ["Ohm's law", "Resistance in series and parallel", "Joule's heating law"], "order": 5},
                {"id": "ch6", "name": f"Magnetic Effects of Current ({board_clean})", "topics": ["Magnetic field lines", "Force on current carrying conductor", "Electromagnetic induction basics"], "order": 6}
            ]
        else: # Grade 11 & 12
            chapters = [
                {"id": "ch1", "name": f"Electrostatics & Capacitance ({board_clean})", "topics": ["Electric charges and fields", "Gauss's law", "Electric potential", "Capacitors"], "order": 1},
                {"id": "ch2", "name": f"Current Electricity ({board_clean})", "topics": ["Ohm's law and drift velocity", "Kirchhoff's rules", "Wheatstone bridge"], "order": 2},
                {"id": "ch3", "name": f"Magnetism & EM Induction ({board_clean})", "topics": ["Biot-Savart law", "Ampere's law", "Lenz's law and Faraday's law"], "order": 3},
                {"id": "ch4", "name": f"Alternating Current & EM Waves ({board_clean})", "topics": ["LCR series circuit", "Transformers", "Electromagnetic waves spectrum"], "order": 4},
                {"id": "ch5", "name": f"Ray & Wave Optics ({board_clean})", "topics": ["Reflection and refraction", "Lenses and optical instruments", "Interference and diffraction"], "order": 5},
                {"id": "ch6", "name": f"Modern Physics & Atoms ({board_clean})", "topics": ["Photoelectric effect", "Bohr's atomic model", "Nuclear fission and fusion"], "order": 12},
                {"id": "ch7", "name": f"Semiconductor Electronics ({board_clean})", "topics": ["Energy bands in solids", "Intrinsic and extrinsic semiconductors", "p-n junction diodes"], "order": 13}
            ]

    # ------------------ CHEMISTRY ------------------
    elif "chem" in sub:
        if grade_num <= 8:
            chapters = [
                {"id": "ch1", "name": f"Synthetic Fibres & Plastics ({board_clean})", "topics": ["Types of synthetic fibres", "Characteristics of plastics", "Plastics and environment"], "order": 1},
                {"id": "ch2", "name": f"Coal & Petroleum ({board_clean})", "topics": ["Natural resources classification", "Fossil fuels formation", "Refining of petroleum"], "order": 2},
                {"id": "ch3", "name": f"Combustion & Flame ({board_clean})", "topics": ["Conditions for combustion", "Structure of a flame", "Fuel efficiency"], "order": 3}
            ]
        elif grade_num in [9, 10]:
            chapters = [
                {"id": "ch1", "name": f"Matter in Our Surroundings ({board_clean})", "topics": ["Physical nature of matter", "States of matter", "Evaporation and latent heat"], "order": 1},
                {"id": "ch2", "name": f"Atoms, Molecules & Structure ({board_clean})", "topics": ["Law of chemical combination", "Valency and chemical formulae", "Bohr-Bury scheme", "Isotopes"], "order": 2},
                {"id": "ch3", "name": f"Chemical Reactions & Equations ({board_clean})", "topics": ["Balanced chemical equations", "Types of reactions (combination, decomposition)", "Corrosion and rancidity"], "order": 3},
                {"id": "ch4", "name": f"Acids, Bases & Salts ({board_clean})", "topics": ["pH scale significance", "Preparation of Sodium hydroxide, Bleaching powder", "Water of crystallization"], "order": 4},
                {"id": "ch5", "name": f"Metals & Non-Metals ({board_clean})", "topics": ["Physical and chemical properties of metals", "Reactivity series", "Ionic compounds formation"], "order": 5},
                {"id": "ch6", "name": f"Carbon & Its Compounds ({board_clean})", "topics": ["Covalent bonding", "Versatile nature of carbon", "Saturated and unsaturated carbon compounds"], "order": 6}
            ]
        else: # Grade 11 & 12
            chapters = [
                {"id": "ch1", "name": f"Solutions & Colligative Properties ({board_clean})", "topics": ["Raoult's law", "Colligative properties", "Abnormal molecular mass"], "order": 1},
                {"id": "ch2", "name": f"Electrochemistry & Kinetics ({board_clean})", "topics": ["Nernst equation", "Kohlrausch's law", "Rate of chemical reactions", "Activation energy"], "order": 2},
                {"id": "ch3", "name": f"d and f Block Elements ({board_clean})", "topics": ["General characteristics", "Lanthanoids and Actinoids"], "order": 3},
                {"id": "ch4", "name": f"Coordination Compounds ({board_clean})", "topics": ["Werner's theory", "Ligands and coordination number", "Isomerism", "Valence bond and crystal field theories"], "order": 4},
                {"id": "ch5", "name": f"Haloalkanes & Organic Mechanisms ({board_clean})", "topics": ["Nucleophilic substitution", "Elimination reactions", "Stereochemistry basics"], "order": 5},
                {"id": "ch6", "name": f"Oxygen containing compounds ({board_clean})", "topics": ["Alcohols, phenols and ethers", "Aldehydes, ketones and carboxylic acids"], "order": 6},
                {"id": "ch7", "name": f"Nitrogen compounds & Biomolecules ({board_clean})", "topics": ["Amines preparation", "Diazonium salts", "Carbohydrates, proteins, and nucleic acids"], "order": 7}
            ]

    # ------------------ ENGLISH ------------------
    elif "eng" in sub:
        chapters = [
            {"id": "ch1", "name": f"Reading Comprehension & Grammar ({board_clean} Grade {grade_num})", "topics": ["Unseen passages", "Tenses and Modals", "Subject-verb agreement", "Active and passive voice"], "order": 1},
            {"id": "ch2", "name": f"Writing Skills ({board_clean} Grade {grade_num})", "topics": ["Letter writing", "Article and essay writing", "Notice and email drafting"], "order": 2},
            {"id": "ch3", "name": f"Literature - Prose & Drama ({board_clean} Grade {grade_num})", "topics": ["Core text study", "Character analysis", "Thematic understanding"], "order": 3},
            {"id": "ch4", "name": f"Literature - Poetry ({board_clean} Grade {grade_num})", "topics": ["Poetic devices", "Stanza explanations", "Central themes of poems"], "order": 4}
        ]

    # ------------------ HINDI ------------------
    elif "hin" in sub:
        chapters = [
            {"id": "ch1", "name": f"Hindi Vyakaran - Grammar ({board_clean} Grade {grade_num})", "topics": ["Sangya, Sarvanam, Kriya", "Karak and Kaal", "Sandhi and Samas", "Muhavare and Lokoktiyan"], "order": 1},
            {"id": "ch2", "name": f"Hindi Rachnatmak Lekhan - Writing ({board_clean} Grade {grade_num})", "topics": ["Patra Lekhan (Formal/Informal)", "Nibandh Lekhan", "Anuched Lekhan", "Vigyapan Lekhan"], "order": 2},
            {"id": "ch3", "name": f"Hindi Gadya Bhaag - Prose ({board_clean} Grade {grade_num})", "topics": ["Detailed prose chapter summaries", "Character sketches", "Theme and message of stories"], "order": 3},
            {"id": "ch4", "name": f"Hindi Kavya Bhaag - Poetry ({board_clean} Grade {grade_num})", "topics": ["Explanation of verses", "Kavyasaundarya", "Central idea of poems"], "order": 4}
        ]

    # ------------------ BIOLOGY ------------------
    elif "bio" in sub:
        if grade_num <= 8:
            chapters = [
                {"id": "ch1", "name": f"Crop Production & Management ({board_clean})", "topics": ["Agricultural practices", "Sowing and irrigation", "Harvesting and storage"], "order": 1},
                {"id": "ch2", "name": f"Microorganisms: Friend & Foe ({board_clean})", "topics": ["Types of microbes", "Commercial and medicinal uses", "Harmful microbes and food preservation"], "order": 2},
                {"id": "ch3", "name": f"Cell: Structure & Functions ({board_clean})", "topics": ["Discovery of cell", "Parts of cell (Nucleus, Cytoplasm)", "Comparison of plant and animal cells"], "order": 3},
                {"id": "ch4", "name": f"Reproduction & Reaching Adolescence ({board_clean})", "topics": ["Asexual and sexual reproduction", "Hormones and endocrine system", "Reproductive health"], "order": 4}
            ]
        elif grade_num in [9, 10]:
            chapters = [
                {"id": "ch1", "name": f"Fundamental Unit of Life & Tissues ({board_clean})", "topics": ["Cell wall, plasma membrane", "Cell organelles", "Plant tissues (Meristematic, Permanent)", "Animal tissues"], "order": 1},
                {"id": "ch2", "name": f"Life Processes ({board_clean})", "topics": ["Nutrition in plants and animals", "Respiration mechanism", "Transportation in humans and plants", "Excretion system"], "order": 2},
                {"id": "ch3", "name": f"Control & Coordination ({board_clean})", "topics": ["Nervous system & Reflex actions", "Human brain structure", "Hormones in animals and plant tropisms"], "order": 3},
                {"id": "ch4", "name": f"How do Organisms Reproduce? ({board_clean})", "topics": ["Fission, budding, regeneration", "Sexual reproduction in flowering plants", "Male and female reproductive systems"], "order": 4},
                {"id": "ch5", "name": f"Heredity & Evolution ({board_clean})", "topics": ["Mendel's contribution", "Law of inheritance", "Sex determination", "Evolutionary theories"], "order": 5},
                {"id": "ch6", "name": f"Our Environment ({board_clean})", "topics": ["Ecosystem components", "Food chains and webs", "Ozone layer depletion", "Waste management"], "order": 6}
            ]
        else: # Grade 11 & 12
            chapters = [
                {"id": "ch1", "name": f"Diversity in the Living World ({board_clean})", "topics": ["Taxonomic hierarchy", "Five kingdom classification", "Salient features of plants and animals"], "order": 1},
                {"id": "ch2", "name": f"Structural Organisation & Cell ({board_clean})", "topics": ["Cell theory", "Prokaryotic and eukaryotic cells", "Biomolecules structure", "Cell cycle and cell division"], "order": 2},
                {"id": "ch3", "name": f"Plant Physiology ({board_clean})", "topics": ["Photosynthesis in higher plants", "Respiration in plants", "Plant growth and regulators"], "order": 3},
                {"id": "ch4", "name": f"Human Physiology ({board_clean})", "topics": ["Breathing and exchange of gases", "Body fluids and circulation", "Neural control and chemical coordination"], "order": 4},
                {"id": "ch5", "name": f"Reproduction & Genetics ({board_clean})", "topics": ["Principles of inheritance", "Molecular basis of inheritance", "Human reproduction and reproductive health"], "order": 5},
                {"id": "ch6", "name": f"Biotechnology & Ecology ({board_clean})", "topics": ["Principles and processes of biotech", "Applications in agriculture/medicine", "Organisms, populations, and ecosystems"], "order": 6}
            ]

    # ------------------ COMPUTER SCIENCE ------------------
    elif "computer" in sub or "comp" in sub or "cs" in sub:
        if grade_num <= 8:
            chapters = [
                {"id": "ch1", "name": f"Computer Network & Communications ({board_clean})", "topics": ["Types of networks (LAN, WAN)", "Network topologies", "Protocols basics"], "order": 1},
                {"id": "ch2", "name": f"Introduction to Scratch & Algorithms ({board_clean})", "topics": ["Writing algorithms", "Flowcharts", "Basic Scratch block coding"], "order": 2},
                {"id": "ch3", "name": f"HTML & Web Design Basics ({board_clean})", "topics": ["HTML structure and tags", "Creating lists and tables", "Hyperlinks and images"], "order": 3}
            ]
        elif grade_num in [9, 10]:
            chapters = [
                {"id": "ch1", "name": f"Computer Systems & Organization ({board_clean})", "topics": ["CPU, memory, storage", "Types of software", "Operating system basics"], "order": 1},
                {"id": "ch2", "name": f"Algorithms & Programming in Python ({board_clean})", "topics": ["Variables and data types", "Conditional statements (if-else)", "Loops (for, while)", "Lists and functions"], "order": 2},
                {"id": "ch3", "name": f"Cyber Safety & Ethics ({board_clean})", "topics": ["Netiquettes", "Cyberbullying prevention", "Digital footprint and copyright basics"], "order": 3}
            ]
        else: # Grade 11 & 12
            chapters = [
                {"id": "ch1", "name": f"Computational Thinking & Python ({board_clean})", "topics": ["Control structures and recursion", "Strings, Lists, Tuples, Dictionaries", "File handling (Text, CSV, Binary)"], "order": 1},
                {"id": "ch2", "name": f"Computer Networks & Protocols ({board_clean})", "topics": ["Transmission media", "TCP/IP, HTTP, DNS protocols", "Network security devices"], "order": 2},
                {"id": "ch3", "name": f"Database Management System & SQL ({board_clean})", "topics": ["Relational databases", "SQL commands (DDL/DML)", "Keys (Primary, Foreign)"], "order": 3},
                {"id": "ch4", "name": f"Data Structures & Stacks ({board_clean})", "topics": ["Stack implementation using list", "Push and Pop operations", "Queue basics"], "order": 4}
            ]

    # ------------------ HISTORY / SOCIAL STUDIES ------------------
    elif "hist" in sub or "social" in sub or "pol" in sub or "civ" in sub or "soc" in sub:
        chapters = [
            {"id": "ch1", "name": f"Nationalism & Historical Eras ({board_clean} Grade {grade_num})", "topics": ["Rise of nationalism", "French Revolution or regional events", "Industrialization impact"], "order": 1},
            {"id": "ch2", "name": f"Democratic Politics & Constitution ({board_clean} Grade {grade_num})", "topics": ["Power sharing", "Federalism and local government", "Constitutional design", "Electoral politics"], "order": 2},
            {"id": "ch3", "name": f"Resources & Economic Development ({board_clean} Grade {grade_num})", "topics": ["Resources and land use", "Agriculture and industries", "Sectors of the economy", "Money and credit"], "order": 3}
        ]

    # ------------------ DEFAULT FALLBACK ------------------
    if not chapters:
        chapters = [
            {"id": "ch1", "name": f"Foundational Concepts of {subject} ({board_clean} Grade {grade_num})", "topics": [f"Basic Definitions of {subject}", "Introductory Terminology", "Practical Relevance"], "order": 1},
            {"id": "ch2", "name": f"Core Methodologies ({board_clean} Grade {grade_num})", "topics": ["Standard analytical tools", "Frameworks & Models", "Comparative analysis"], "order": 2},
            {"id": "ch3", "name": f"Practical Exercises ({board_clean} Grade {grade_num})", "topics": ["Lab work / Case studies", "Problem solving strategies", "Project work"], "order": 3}
        ]
        
    return {"chapters": chapters}

def get_mock_notes(subject: str, chapter_name: str) -> str:
    return f"""# Study Notes: {chapter_name} ({subject})

## Introduction
Welcome to your comprehensive study notes for **{chapter_name}**. This guide covers the core concepts, definitions, and equations required to master this topic.

## Core Concepts
Here are the primary pillars of this chapter:

1. **Fundamental Definition**: A solid understanding starts with defining the key concepts clearly. Every theorem or formula is built upon these baseline definitions.
2. **Key Theoretical Frameworks**: Multiple models explain the behavior of these systems under varying conditions.
3. **Common Applications**: These principles are applied in both academic scenarios and industrial settings to solve real-world problems.

## Formulas and Key Relations
When solving problems, keep the following core relationships in mind:

*   **Primary Relation**: $E = mc^2$ (or subject-specific equivalent relation).
*   **Rate of Change**: $\\frac{{dY}}{{dX}} = f'(X)$ which demonstrates the sensitivity of one variable to another.
*   **Conservation Principle**: Total Initial State = Total Final State, meaning energy/mass/momentum cannot be created or destroyed within a closed system.

## Solved Example
**Problem**: Calculate the optimal state change given $A = 10$ and $B = 5$ with a efficiency factor of $0.8$.

**Solution**:
1. Identify the relation: $Result = A \\times B \\times \\text{{efficiency}}$
2. Substitute the values: $Result = 10 \\times 5 \\times 0.8$
3. Compute the final answer: $Result = 40$ units.

## Summary & Review Tips
- Always verify your units before finalizing calculations.
- Break down complex multi-part questions into individual component equations.
- Practice drawing diagrams to represent the forces, limits, or systems described.
"""

def get_mock_short_notes(subject: str, chapter_name: str) -> str:
    return f"""# Quick Revision Notes: {chapter_name} ({subject})

*   **Key Formula**: $Y = mX + C$ - foundational linear model.
*   **Crucial Concept**: The primary constraint is resource allocation and conservation laws.
*   **Quick Tip**: If $X$ increases, $Y$ changes proportionally to the coefficient $m$.
*   **Exam Alert**: Watch out for boundary conditions (e.g., when $X = 0$). This is a frequent trick question on exams!
*   **Definitions**:
    *   *System*: The boundary containing all variables under review.
    *   *Surroundings*: Everything outside the system boundary.
    *   *Equilibrium*: The state where opposing forces or actions are completely balanced.
"""

def get_mock_flashcards(subject: str, chapter_name: str) -> list:
    return [
        {"front": f"What is the primary definition of {chapter_name}?", "back": "It is the structured study of how systems change, react, or behave under specific external forces or conditions."},
        {"front": f"List 3 critical components to remember in {chapter_name}.", "back": "1. Boundary conditions\n2. Conservation laws\n3. Rates of conversion or change."},
        {"front": f"What is a common pitfall to avoid in exams for {chapter_name}?", "back": "Forgetting to convert units to the standard SI/metric system and neglecting negative signs in balance equations."},
        {"front": f"State the primary law or theorem of this chapter.", "back": "The total system output is equal to the sum of individual inputs minus losses due to friction, resistance, or entropy."},
        {"front": f"How does temperature or scale affect the rate of reaction/change?", "back": "In most physical systems, an increase in temperature or scale speeds up the rate of change exponentially."}
    ]

def get_mock_important_questions(subject: str, chapter_name: str) -> list:
    return [
        {
            "question": f"Explain the fundamental theorem of {chapter_name} and write its mathematical representation.",
            "type": "important",
            "guideline_answer": "The fundamental theorem establishes that integration/summation and differentiation/rate of change are inverse operations. Mathematically represented as F(b) - F(a) = \\int_{a}^{b} f(x)dx. Students should define all variables and state assumptions of continuity."
        },
        {
            "question": f"Compare and contrast the primary and secondary factors influencing this system.",
            "type": "practice",
            "guideline_answer": "Primary factors directly determine the baseline state (e.g., temperature, pressure, raw material). Secondary factors affect rate and efficiency (e.g., catalysts, surface area, minor variables). A structured comparative table is recommended."
        },
        {
            "question": f"Solve a system where initial input is 250 units, resistance is 12%, and final output needs to be evaluated.",
            "type": "important",
            "guideline_answer": "1. Formula: Output = Input * (1 - Resistance) \n2. Calculation: Output = 250 * (1 - 0.12) = 250 * 0.88 = 220 units. Students must state units clearly."
        }
    ]

def get_mock_quiz(subject: str, chapter_name: str) -> list:
    return [
        {
            "id": 1,
            "text": f"Which of the following is the fundamental governing principle of {chapter_name}?",
            "options": [
                "The Principle of Least Effort",
                "Conservation of Energy/Mass",
                "Random Distribution Hypothesis",
                "Infinite Expansion Axiom"
            ],
            "correct_option_index": 1,
            "explanation": "Conservation laws dictate that the total energy or mass remains constant in an isolated system, forming the backbone of scientific analysis."
        },
        {
            "id": 2,
            "text": "What is the primary unit of measurement for rates of change in this subject?",
            "options": [
                "Radians per second",
                "Units per interval (dependent/independent)",
                "Joules per Kelvin",
                "Decibels"
            ],
            "correct_option_index": 1,
            "explanation": "Rates of change are defined by the change in the dependent variable divided by the change in the independent variable."
        },
        {
            "id": 3,
            "text": "Which common mistake leads to incorrect results in numerical problems here?",
            "options": [
                "Using double precision floating values",
                "Ignoring boundary conditions",
                "Writing equations in active voice",
                "Using metric standard systems"
            ],
            "correct_option_index": 1,
            "explanation": "Failing to check boundary conditions (e.g., at t=0 or limits) often causes major errors in integration and state computations."
        },
        {
            "id": 4,
            "text": "Who is historically credited with formulating the first modern model for these concepts?",
            "options": [
                "Isaac Newton & Gottfried Leibniz",
                "Albert Einstein",
                "Marie Curie",
                "Alan Turing"
            ],
            "correct_option_index": 0,
            "explanation": "Newton and Leibniz independently developed the infinitesimal calculus, which provides the mathematical tools for these models."
        },
        {
            "id": 5,
            "text": "If you scale the input variables by a factor of 3 in a linear system, how does the output scale?",
            "options": [
                "It remains unchanged",
                "It increases by 9 (square law)",
                "It increases by a factor of 3",
                "It decreases to 1/3"
            ],
            "correct_option_index": 2,
            "explanation": "By the property of homogeneity in linear systems, scaling inputs by a constant scales the outputs by the exact same constant factor."
        }
    ]


# --- Gemini API Callers ---
def generate_syllabus(subject: str, board: str, grade_class: str, stream: str = None) -> dict:
    if not client:
        print(f"[WARNING] Gemini Client is not initialized (no API Key found). Falling back to mock syllabus for {subject} ({board}, {grade_class}).")
        return get_mock_syllabus(subject, board, grade_class, stream)
    
    prompt = f"""
    You are an expert academic curriculum designer.
    Create a complete, comprehensive, and highly structured syllabus matching the official prescribed curriculum guidelines for:
    Subject: {subject}
    Board/Curriculum: {board}
    Grade/Class: {grade_class}
    Stream (if applicable): {stream or 'N/A'}
    
    Provide the full set of sequential chapters that cover the entire standard curriculum for this subject, grade, and board (usually 8-15 chapters depending on the subject).
    For each chapter, specify a short id (e.g., ch1, ch2), name, list of 3-5 subtopics, and its sequential order.
    Ensure the chapter names and topics are highly accurate to the specified Board/Curriculum and Grade/Class.
    """
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SyllabusResponse,
                temperature=0.2
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Gemini API Error (generate_syllabus), falling back to mock: {e}")
        return get_mock_syllabus(subject, board, grade_class, stream)

def generate_chapter_material(chapter_name: str, subject: str, material_type: str) -> str:
    """
    Generates study materials for a given chapter.
    material_type can be: 'notes', 'short_notes', 'flashcards', 'important_questions'
    """
    if not client:
        print(f"[WARNING] Gemini Client is not initialized (no API Key found). Falling back to mock chapter material ({material_type}) for {chapter_name} ({subject}).")
        if material_type == 'notes':
            return get_mock_notes(subject, chapter_name)
        elif material_type == 'short_notes':
            return get_mock_short_notes(subject, chapter_name)
        elif material_type == 'flashcards':
            return json.dumps(get_mock_flashcards(subject, chapter_name))
        elif material_type == 'important_questions':
            return json.dumps(get_mock_important_questions(subject, chapter_name))
        return ""

    if material_type == 'notes':
        prompt = f"Write comprehensive, detailed textbook style study notes in Markdown for the chapter: '{chapter_name}' in the subject: '{subject}'. Include headings, bullet points, explanations, equations in LaTeX if needed, and a solved example."
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.4)
            )
            return response.text
        except Exception as e:
            print(f"Gemini API Error (generate_notes): {e}")
            return get_mock_notes(subject, chapter_name)

    elif material_type == 'short_notes':
        prompt = f"Write brief, high-impact bulleted revision notes in Markdown for the chapter: '{chapter_name}' in the subject: '{subject}'. Focus on exam formulas, key definitions, and quick reminders."
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.3)
            )
            return response.text
        except Exception as e:
            print(f"Gemini API Error (generate_short_notes): {e}")
            return get_mock_short_notes(subject, chapter_name)

    elif material_type == 'flashcards':
        prompt = f"Create exactly 5 structured Q&A flashcards for active recall study of the chapter: '{chapter_name}' in the subject: '{subject}'."
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=FlashcardsResponse,
                    temperature=0.5
                ),
            )
            return response.text
        except Exception as e:
            print(f"Gemini API Error (generate_flashcards): {e}")
            return json.dumps(get_mock_flashcards(subject, chapter_name))

    elif material_type == 'important_questions':
        prompt = f"Generate 3 important or practice questions for exams, with marking guidelines/guideline answers, for the chapter: '{chapter_name}' in the subject: '{subject}'."
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ImportantQuestionsResponse,
                    temperature=0.4
                ),
            )
            return response.text
        except Exception as e:
            print(f"Gemini API Error (generate_important_questions): {e}")
            return json.dumps(get_mock_important_questions(subject, chapter_name))

    return ""

def generate_quiz(chapter_name: str, subject: str) -> list:
    if not client:
        print(f"[WARNING] Gemini Client is not initialized (no API Key found). Falling back to mock quiz for {chapter_name} ({subject}).")
        return get_mock_quiz(subject, chapter_name)

    prompt = f"Create exactly 5 multiple-choice quiz questions for the chapter: '{chapter_name}' in the subject: '{subject}'. Each question must have 4 options, a correct option index (0-3), and an explanation."
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QuizResponse,
                temperature=0.5
            ),
        )
        data = json.loads(response.text)
        return data.get("questions", [])
    except Exception as e:
        print(f"Gemini API Error (generate_quiz): {e}")
        return get_mock_quiz(subject, chapter_name)

def evaluate_quiz_results(questions: list, user_answers: list) -> dict:
    """
    Evaluates answers and returns weak topics.
    """
    score = 0
    total = len(questions)
    wrong_questions_texts = []
    
    for i, q in enumerate(questions):
        user_ans = user_answers[i] if i < len(user_answers) else None
        if user_ans == q.get("correct_option_index"):
            score += 1
        else:
            wrong_questions_texts.append(q.get("text"))

    if not client or not wrong_questions_texts:
        if not client:
            print("[WARNING] Gemini Client is not initialized (no API Key found). Falling back to basic evaluation of weak topics.")
        weak_topics = []
        if wrong_questions_texts:
            weak_topics = [f"Revision topic from quiz Q{i+1}" for i, q in enumerate(questions) if (user_answers[i] if i < len(user_answers) else None) != q.get("correct_option_index")]
        return {"score": score, "total": total, "weak_topics": weak_topics[:3]}

    prompt = f"""
    The student answered the following quiz questions incorrectly:
    {json.dumps(wrong_questions_texts)}
    
    Based on these questions, suggest exactly 2 or 3 short, specific topics (e.g. "Linear equations", "Laws of motion") that the student should revise. Output as a plain JSON array of strings.
    """
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            ),
        )
        weak_topics = json.loads(response.text)
        if isinstance(weak_topics, list):
            return {"score": score, "total": total, "weak_topics": weak_topics}
        return {"score": score, "total": total, "weak_topics": []}
    except Exception as e:
        weak_topics = [f"Topic relating to question {i+1}" for i, q in enumerate(questions) if (user_answers[i] if i < len(user_answers) else None) != q.get("correct_option_index")]
        return {"score": score, "total": total, "weak_topics": weak_topics[:3]}


# --- STUDY SCHEDULE SCHEMAS & FUNCTIONS ---
class StudyScheduleTask(BaseModel):
    date: str = Field(description="Date for the revision task in YYYY-MM-DD format")
    subject: str = Field(description="Name of the subject")
    chapter_id: str = Field(description="The chapter ID to revise, e.g., ch1, ch2")
    chapter_name: str = Field(default="Revision Task", description="Name of the chapter")
    duration_mins: int = Field(description="Study session duration in minutes (e.g. 60, 90, 120)")
    difficulty: str = Field(default="Medium", description="Difficulty level: Easy, Medium, or Hard")
    completed: bool = Field(default=False, description="Should default to false")

class StudyScheduleResponse(BaseModel):
    schedule: list[StudyScheduleTask]

def parse_date_to_iso(date_str: str) -> str:
    import re
    from datetime import datetime
    date_str = date_str.strip()
    
    # Try YYYY-MM-DD or YYYY/MM/DD
    match = re.search(r"(\d{4})[-/](\d{1,2})[-/](\d{1,2})", date_str)
    if match:
        try:
            dt = datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
            
    # Try DD-MM-YYYY or DD/MM/YYYY or MM-DD-YYYY or MM/DD/YYYY
    match = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", date_str)
    if match:
        part1 = int(match.group(1))
        part2 = int(match.group(2))
        year = int(match.group(3))
        
        # Try DD-MM-YYYY first (as it's very common)
        try:
            dt = datetime(year, part2, part1)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            # Try MM-DD-YYYY
            try:
                dt = datetime(year, part1, part2)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
                
    # Try textual dates: e.g. "July 20, 2026" or "20 July 2026"
    months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
              "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    
    for i, m in enumerate(months):
        if m in date_str.lower():
            month_val = (i % 12) + 1
            year_match = re.search(r"\b(\d{4})\b", date_str)
            year = int(year_match.group(1)) if year_match else datetime.now().year
            text_no_year = re.sub(r"\b\d{4}\b", "", date_str)
            day_match = re.search(r"\b(\d{1,2})\b", text_no_year)
            day = int(day_match.group(1)) if day_match else 1
            try:
                dt = datetime(year, month_val, day)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass
    return None

def parse_datesheet(datesheet_text: str) -> dict:
    import re
    exam_schedule = {}
    for line in datesheet_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        
        # Split by typical separators
        parts = []
        for sep in [":", " - ", "\t", ","]:
            if sep in line:
                parts = [p.strip() for p in line.split(sep, 1)]
                break
                
        if not parts:
            # Try splitting by space if we can identify a date pattern
            date_match = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})|(\d{1,2}\s+[A-Za-z]+(\s+\d{4})?)|([A-Za-z]+\s+\d{1,2}(\s+\d{4})?)", line)
            if date_match:
                date_str = date_match.group(0)
                sub_str = line.replace(date_str, "").strip(" :-,\t")
                parts = [sub_str, date_str]
                
        if len(parts) >= 2:
            part1, part2 = parts[0], parts[1]
            parsed1 = parse_date_to_iso(part1)
            parsed2 = parse_date_to_iso(part2)
            
            if parsed2:
                exam_schedule[part1] = parsed2
            elif parsed1:
                exam_schedule[part2] = parsed1
    return exam_schedule

def get_mock_study_schedule(datesheet_text: str, syllabi_list: list) -> dict:
    import re
    from datetime import datetime, timedelta
    
    # Robust parsing of datesheet
    exam_dates = {}
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    parsed_exams = parse_datesheet(datesheet_text)
    for sub, parsed_date in parsed_exams.items():
        try:
            exam_dates[sub.lower().strip()] = datetime.strptime(parsed_date, "%Y-%m-%d")
        except ValueError:
            pass
                
    schedule_tasks = []
    days_load = {}
    
    # Collect all detailed sub-tasks
    all_tasks_to_schedule = []
    
    for s_data in syllabi_list:
        sub = s_data.get("subject", "")
        chapters = s_data.get("chapters", [])
        
        # Determine target exam date via fuzzy match
        target_exam_date = None
        sub_lower = sub.lower().strip()
        for exam_sub, exam_date in exam_dates.items():
            if exam_sub in sub_lower or sub_lower in exam_sub:
                target_exam_date = exam_date
                break
                
        if not target_exam_date:
            target_exam_date = today + timedelta(days=30)
            
        max_days = (target_exam_date - today).days
        if max_days <= 0:
            max_days = 1
            
        # Create 4 detailed daily sub-tasks per chapter: Notes, Flashcards, Quiz, Q&A
        for ch in chapters:
            ch_id = ch.get("id", "ch1")
            ch_name = ch.get("name", "Chapter")
            
            sub_lower = sub.lower()
            is_sci = "math" in sub_lower or "phys" in sub_lower or "chem" in sub_lower
            
            tasks_meta = [
                {"name": f"Study Notes: {ch_name}", "duration": 90 if is_sci else 60, "difficulty": "Medium"},
                {"name": f"Practice Flashcards: {ch_name}", "duration": 45 if is_sci else 30, "difficulty": "Easy"},
                {"name": f"Solve Chapter Quiz: {ch_name}", "duration": 60 if is_sci else 45, "difficulty": "Hard" if is_sci else "Medium"},
                {"name": f"Practice Important Q&A: {ch_name}", "duration": 75 if is_sci else 45, "difficulty": "Hard" if is_sci else "Medium"}
            ]
            
            for t_idx, t_meta in enumerate(tasks_meta):
                all_tasks_to_schedule.append({
                    "subject": sub,
                    "chapter_id": ch_id,
                    "chapter_name": ch_name,
                    "task_name": t_meta["name"],
                    "duration_mins": t_meta["duration"],
                    "difficulty": t_meta["difficulty"],
                    "max_days": max_days,
                    "sub_order": t_idx
                })
                
    # Sort all_tasks_to_schedule to prioritize subjects with earlier exams
    # and maintain logical sub-task progression order
    all_tasks_to_schedule.sort(key=lambda x: (x["max_days"], x["sub_order"]))
    
    # Calculate max duration of overall calendar
    max_overall_days = 30 if not exam_dates else 1
    for sub, exam_date in exam_dates.items():
        diff = (exam_date - today).days
        if diff > max_overall_days:
            max_overall_days = diff
            
    # Step 1: Place main tasks using the load-balancing cost formula
    for task in all_tasks_to_schedule:
        max_days = task["max_days"]
        sub_order = task["sub_order"]
        
        # Target day is spaced out chronologically based on sub_order fraction
        ideal_fraction = (sub_order / 4.0)
        target_day = int(ideal_fraction * (max_days - 1))
        
        best_day_offset = target_day
        min_cost = 999999
        
        for d in range(max_days):
            date_str = (today + timedelta(days=d)).strftime("%Y-%m-%d")
            load = days_load.get(date_str, 0)
            cost = load * 100 + abs(d - target_day)
            if cost < min_cost:
                min_cost = cost
                best_day_offset = d
                
        task_date = today + timedelta(days=best_day_offset)
        task_date_str = task_date.strftime("%Y-%m-%d")
        days_load[task_date_str] = days_load.get(task_date_str, 0) + 1
        
        schedule_tasks.append({
            "date": task_date_str,
            "subject": task["subject"],
            "chapter_id": task["chapter_id"],
            "chapter_name": task["task_name"], # Display the sub-task description
            "duration_mins": task["duration_mins"],
            "difficulty": task["difficulty"],
            "completed": False
        })
        
    # Step 2: Scan for any remaining empty days and schedule a Mixed Active Recall task
    for d in range(max_overall_days):
        date_str = (today + timedelta(days=d)).strftime("%Y-%m-%d")
        if days_load.get(date_str, 0) == 0:
            subject = syllabi_list[0].get("subject", "General Studies") if syllabi_list else "General Studies"
            schedule_tasks.append({
                "date": date_str,
                "subject": subject,
                "chapter_id": "gen_rev",
                "chapter_name": "Active Recall & Weak Topics Review",
                "duration_mins": 60,
                "difficulty": "Medium",
                "completed": False
            })
            days_load[date_str] = 1
            
    # Sort schedule chronologically
    schedule_tasks.sort(key=lambda x: x["date"])
    return {"schedule": schedule_tasks}

def generate_study_schedule(datesheet_text: str, syllabi_list: list) -> dict:
    return get_mock_study_schedule(datesheet_text, syllabi_list)

