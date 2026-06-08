import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import async_session_factory
from app.models.job import Job

async def seed_jobs():
    async with async_session_factory() as session:
        # Create mock jobs
        jobs = [
            Job(
                platform="linkedin",
                platform_job_id=str(uuid.uuid4()),
                title="Junior Machine Learning Engineer",
                company="AlphaAI",
                location="San Francisco, CA (Hybrid)",
                url="https://linkedin.com/jobs/view/1",
                description=(
                    "AlphaAI is looking for a passionate Junior Machine Learning Engineer "
                    "to join our core AI team. You will be working on cutting-edge LLMs and "
                    "computer vision pipelines. Requirements: Python, PyTorch, FAISS, and "
                    "a solid understanding of neural networks."
                ),
                salary_range="$100k - $130k",
                job_type="Full-time",
                remote=False,
                experience_level="Entry-level",
                match_score=0.85,
                status="new",
                posted_date=datetime.utcnow()
            ),
            Job(
                platform="indeed",
                platform_job_id=str(uuid.uuid4()),
                title="Data Engineer Intern",
                company="TechCorp",
                location="Remote",
                url="https://indeed.com/viewjob?jk=1",
                description=(
                    "TechCorp is seeking a motivated Data Engineer Intern for the summer. "
                    "You will help build scalable ETL pipelines and work with big data tools "
                    "like Apache Spark and Kafka. Experience with SQL and Python is a must."
                ),
                salary_range="$30/hr - $45/hr",
                job_type="Internship",
                remote=True,
                experience_level="Internship",
                match_score=0.90,
                status="new",
                posted_date=datetime.utcnow()
            ),
            Job(
                platform="glassdoor",
                platform_job_id=str(uuid.uuid4()),
                title="Software Engineer, Backend",
                company="FinTech Innovators",
                location="New York, NY",
                url="https://glassdoor.com/job/1",
                description=(
                    "Join FinTech Innovators to revolutionize digital banking. "
                    "We are looking for a strong Backend Engineer proficient in Python, FastAPI, "
                    "and PostgreSQL. You will design and implement high-throughput REST APIs and "
                    "ensure secure financial transactions."
                ),
                salary_range="$130k - $160k",
                job_type="Full-time",
                remote=False,
                experience_level="Mid-level",
                match_score=0.72,
                status="new",
                posted_date=datetime.utcnow()
            )
        ]
        
        session.add_all(jobs)
        await session.commit()
        print(f"Successfully seeded {len(jobs)} mock jobs into the database.")

if __name__ == "__main__":
    asyncio.run(seed_jobs())
