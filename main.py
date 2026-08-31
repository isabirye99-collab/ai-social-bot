import os
import sqlite3
import json
from datetime import datetime, date
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
from apscheduler.schedulers.background import BackgroundScheduler

app = FastAPI(title="Unified AI Responder & Daily Reporting Engine")

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

MODEL_NAME = "llama-3.3-70b-versatile"
DB_NAME = "interactions.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel TEXT NOT NULL,
            sender TEXT NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            sentiment TEXT NOT NULL,
            status TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

class MessageInput(BaseModel):
    channel: str
    sender: str
    message: str

def analyze_and_respond(channel: str, message: str) -> dict:
    prompt = f"""
    You are an AI customer support assistant managing inquiries from {channel}.
    System Rules:
    - Keep social media responses under 280 characters.
    - Email responses can be detailed and professional.
    - If the request is urgent or complex, set status to 'ESCALATED'. Otherwise 'RESOLVED'.
    
    User Message: "{message}"
    
    Respond STRICTLY in JSON format with keys:
    "reply": "The response string",
    "sentiment": "Positive/Neutral/Negative/Urgent",
    "status": "RESOLVED or ESCALATED"
    """
    
    try:
        response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"Groq API Error: {e}")
        return {
            "reply": "Thank you for reaching out. A human agent will get back to you shortly.",
            "sentiment": "Neutral",
            "status": "ESCALATED"
        }    
    

def log_interaction(channel: str, sender: str, message: str, response: str, sentiment: str, status: str):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO logs (channel, sender, message, response, sentiment, status) VALUES (?, ?, ?, ?, ?, ?)",
        (channel, sender, message, response, sentiment, status)
    )
    conn.commit()
    conn.close()

@app.post("/webhook/inbound")
async def handle_inbound_message(data: MessageInput):
    ai_result = analyze_and_respond(data.channel, data.message)
    
    log_interaction(
        channel=data.channel,
        sender=data.sender,
        message=data.message,
        response=ai_result["reply"],
        sentiment=ai_result["sentiment"],
        status=ai_result["status"]
    )
    
    return {
        "status": "success",
        "generated_reply": ai_result["reply"],
        "action_taken": ai_result["status"]
    }

@app.get("/report/end-of-day")
def generate_daily_report():
    today = date.today().isoformat()
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Select all logs recorded today (flexible string matching)
    cursor.execute("SELECT channel, sender, message, response, sentiment, status FROM logs WHERE timestamp LIKE ?", (f"{today}%",))
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return {
            "date": today,
            "total_interactions": 0,
            "report": "No customer activity recorded today yet. Send a test message via /webhook/inbound first!"
        }
        
    formatted_logs = "\n".join([f"[{r[0]}] {r[1]}: {r[2]} | Sent: {r[4]} | Status: {r[5]}" for r in rows])
    
    report_prompt = f"""
    Analyze today's customer interactions and generate a concise End-of-Day Executive Summary.
    
    Raw Logs:
    {formatted_logs}
    
    Include:
    1. Total volume & breakdown by channel.
    2. Primary topics/pain points identified.
    3. Critical items requiring human follow-up.
    """
    
    try:
        report_response = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[{"role": "user", "content": report_prompt}]
        )
        report_text = report_response.choices[0].message.content
    except Exception as e:
        print(f"Report Generation Error: {e}")
        report_text = f"Summary generated locally: Processed {len(rows)} interactions today."
    
    return {
        "date": today,
        "total_interactions": len(rows),
        "report": report_text
    }
def send_automated_daily_report():
    report_data = generate_daily_report()
    print("=== AUTOMATED END-OF-DAY REPORT ===")
    print(report_data.get("report"))

scheduler = BackgroundScheduler()
scheduler.add_job(send_automated_daily_report, 'cron', hour=18, minute=0)
scheduler.start()