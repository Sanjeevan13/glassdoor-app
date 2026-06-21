from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import pandas as pd
import os
import re
import joblib
import scipy
from scipy.sparse import hstack
import nltk

# Determine directory paths relative to the file location (api folder)
API_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(API_DIR, "glassdoor_website_database.csv")
MODEL_FILE = os.path.join(API_DIR, "sentiment_model.pkl")
VEC_PROS_FILE = os.path.join(API_DIR, "tfidf_vectorizer_pros.pkl")
VEC_CONS_FILE = os.path.join(API_DIR, "tfidf_vectorizer_cons.pkl")

# Initialize FastAPI App
app = FastAPI(title="Glassdoor Company Review Dashboard API")

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load CSV Database
try:
    df = pd.read_csv(DATA_FILE)
    df["firm"] = df["firm"].astype(str).str.strip()
    print("Database loaded successfully.")
except Exception as e:
    print(f"Error loading database file: {e}")
    # Create empty dataframe as a fallback
    df = pd.DataFrame(columns=[
        "firm", "rating", "sentiment", "pros", "cons",
        "work_life_balance", "culture_values", "diversity_inclusion",
        "career_opp", "comp_benefits", "senior_mgmt"
    ])

# Set up local bundled NLTK data directory (pre-downloaded and unzipped)
nltk_data_dir = os.path.join(API_DIR, "nltk_data")
if nltk_data_dir not in nltk.data.path:
    nltk.data.path.insert(0, nltk_data_dir)

# Load NLTK resources
try:
    from nltk.corpus import stopwords
    from nltk.stem import WordNetLemmatizer
    stop_words = set(stopwords.words("english"))
    lemmatizer = WordNetLemmatizer()
    nltk_loaded = True
    print("Local NLTK data loaded successfully.")
except Exception as e:
    print(f"Error loading local NLTK libraries: {e}")
    nltk_loaded = False
    stop_words = set()
    lemmatizer = None

# Load Sentiment Prediction Model & Vectorizers
model = None
vec_pros = None
vec_cons = None
models_loaded = False

if os.path.exists(MODEL_FILE) and os.path.exists(VEC_PROS_FILE) and os.path.exists(VEC_CONS_FILE):
    try:
        model = joblib.load(MODEL_FILE)
        vec_pros = joblib.load(VEC_PROS_FILE)
        vec_cons = joblib.load(VEC_CONS_FILE)
        models_loaded = True
        print("ML Models loaded successfully.")
    except Exception as e:
        print(f"Error loading model pkl files: {e}")

# API ENDPOINTS

@app.get("/api/companies")
def get_companies():
    """Returns a sorted list of unique company names from the database."""
    if df.empty:
        return {"companies": []}
    all_firms = sorted(df["firm"].unique())
    return {"companies": all_firms}

@app.get("/api/summary")
def get_summary(company: str = Query(..., description="Company name to search")):
    """Calculates review metrics, category ratings, sentiment breakdown, and returns pros/cons."""
    if df.empty:
        raise HTTPException(status_code=500, detail="Database is not available.")
    
    company_df = df[df["firm"].str.lower() == company.lower()]
    if company_df.empty:
        raise HTTPException(status_code=404, detail=f"Company '{company}' not found.")
    
    overall_rating = round(company_df["rating"].mean(), 2)
    
    # Subcategory rating columns from data
    SUB_RATING_COLS = {
        "work_life_balance": "Work-Life Balance",
        "culture_values": "Culture & Values",
        "diversity_inclusion": "Diversity & Inclusion",
        "career_opp": "Career Opportunities",
        "comp_benefits": "Compensation & Benefits",
        "senior_mgmt": "Senior Management",
    }
    
    sub_ratings = {}
    for col, label in SUB_RATING_COLS.items():
        if col in company_df.columns:
            # Clean nulls
            mean_val = company_df[col].dropna().mean()
            sub_ratings[label] = round(mean_val, 2) if not pd.isna(mean_val) else 0.0
        else:
            sub_ratings[label] = 0.0
            
    # Calculate sentiment distribution
    sentiment_counts = company_df["sentiment"].value_counts()
    total_sentiment = len(company_df)
    sentiment_pct = {
        str(k): round((v / total_sentiment) * 100, 1)
        for k, v in sentiment_counts.to_dict().items()
    }
    
    # Clean, deduplicate and fetch top pros/cons (sorted by length to find descriptive reviews)
    pros_list = (
        company_df.loc[company_df["pros"].astype(str).str.strip() != "", "pros"]
        .dropna()
        .astype(str)
        .drop_duplicates()
        .sort_values(key=lambda s: s.str.len(), ascending=False)
        .tolist()
    )
    
    cons_list = (
        company_df.loc[company_df["cons"].astype(str).str.strip() != "", "cons"]
        .dropna()
        .astype(str)
        .drop_duplicates()
        .sort_values(key=lambda s: s.str.len(), ascending=False)
        .tolist()
    )
    
    return {
        "firm": company_df["firm"].iloc[0],
        "review_count": len(company_df),
        "overall_rating": overall_rating,
        "sub_ratings": sub_ratings,
        "sentiment_pct": sentiment_pct,
        "pros_list": [p.strip() for p in pros_list[:10]],  # top 10
        "cons_list": [c.strip() for c in cons_list[:10]]   # top 10
    }

class PredictRequest(BaseModel):
    pros: str
    cons: str

@app.post("/api/predict")
def predict_sentiment_endpoint(req: PredictRequest):
    """Predicts review sentiment from input pros and cons text using ML models."""
    if not models_loaded:
        raise HTTPException(status_code=503, detail="Sentiment analysis models are not available.")
    if not nltk_loaded or lemmatizer is None:
        raise HTTPException(status_code=500, detail="Natural language processing tools failed to initialize.")
    if not req.pros.strip() and not req.cons.strip():
        raise HTTPException(status_code=400, detail="Please provide either Pros or Cons text.")
    
    # Mirror text preprocessing
    def clean_text(text: str) -> str:
        text = text.lower()
        text = text.encode("ascii", "ignore").decode("ascii")
        text = re.sub(r"http\S+|www\S+", "", text)
        text = re.sub(r"[^a-z\s]", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def lemmatize_text(text: str) -> str:
        words = text.split()
        return " ".join(lemmatizer.lemmatize(w) for w in words if w not in stop_words)

    pros_clean = lemmatize_text(clean_text(req.pros))
    cons_clean = lemmatize_text(clean_text(req.cons))

    # Run vectorizers and predict
    try:
        X_pros = vec_pros.transform([pros_clean])
        X_cons = vec_cons.transform([cons_clean])
        X_combined = hstack([X_pros, X_cons])

        prediction = model.predict(X_combined)[0]

        probabilities = None
        if hasattr(model, "predict_proba"):
            proba_values = model.predict_proba(X_combined)[0]
            probabilities = {
                str(cls): round(float(val) * 100, 1)
                for cls, val in zip(model.classes_, proba_values)
            }

        return {
            "sentiment": str(prediction),
            "probabilities": probabilities
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

# Mount static web directory.
BASE_DIR = os.path.dirname(API_DIR)
public_dir = os.path.join(BASE_DIR, "public")
if os.path.exists(public_dir):
    app.mount("/", StaticFiles(directory=public_dir, html=True), name="static")
