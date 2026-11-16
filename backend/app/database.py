from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "postgresql+psycopg://digvo_user:digvo_secret_password@localhost:5432/digvo_db"

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    with engine.begin() as conn:
        # Wymagane przez PostgreSQL do tworzenia ograniczeń EXCLUDE na przedziałach czasowych
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist;"))
    Base.metadata.create_all(bind=engine)