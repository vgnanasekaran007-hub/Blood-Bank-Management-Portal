# LifePulse Production Deployment Guide
## GitHub &rarr; Vercel &rarr; Render &rarr; Supabase Architecture
**Course:** CCS375 – Web Technologies | **Team:** Team 1

---

### Production Topology Overview
```
+------------------+         HTTPS API Calls        +------------------+
| Vercel Frontend  | =============================> |  Render Backend  |
| (HTML5/CSS3/JS)  | <============================= | (Django/Gunicorn)|
+------------------+      CORS & JSON Responses     +--------+---------+
                                                             |
                                                   PostgreSQL Connection Pool
                                                             |
                                                    +--------v---------+
                                                    |  Supabase DB     |
                                                    | (PostgreSQL 15+) |
                                                    +------------------+
```

---

### Step 1: Supabase Database Setup
1. Log in to [Supabase](https://supabase.com) and click **"New Project"**.
2. Set Project Name: `lifepulse-blood-bank`.
3. Choose Database Password and select region (e.g. `Singapore` / `ap-southeast-1` for minimal latency to India).
4. Navigate to **SQL Editor** in the Supabase Dashboard.
5. Open [`backend/supabase_schema.sql`](file:///home/kali/Projects/backend/supabase_schema.sql), copy its entire contents, paste it into the SQL Editor, and click **Run**.
   - This creates all 7 tables, check constraints (`CHECK (units_available >= 0)`), indexes, and initial inventory rows.
6. Navigate to **Project Settings &rarr; Database &rarr; Connection String**.
7. Copy the **URI** connection string. It will look like:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   *(Keep this URI handy for Step 2)*.

---

### Step 2: Render Backend Deployment
1. Log in to [Render](https://render.com) and click **"New +" &rarr; "Web Service"**.
2. Connect your GitHub repository: `https://github.com/vgnanasekaran007-hub/Blood-Bank-Management-Portal`.
3. Configure the Web Service settings:
   - **Name:** `blood-bank-portal-backend`
   - **Region:** `Singapore` (or matching Supabase region)
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:**
     ```bash
     pip install -r requirements.txt && python manage.py migrate && python seed_data.py
     ```
   - **Start Command:**
     ```bash
     gunicorn bloodportal.wsgi:application --bind 0.0.0.0:$PORT
     ```
4. Configure **Environment Variables** in Render:
   - `DATABASE_URL`: Paste the Supabase connection string from Step 1.
   - `DEBUG`: `False`
   - `SECRET_KEY`: Generate a 50-character random key or use a secure passphrase.
   - `ALLOWED_HOSTS`: `*.onrender.com,localhost,127.0.0.1`
   - `PYTHON_VERSION`: `3.12.0`
5. Click **"Create Web Service"**.
6. Once deployed, verify the health check endpoint:
   ```bash
   curl https://blood-bank-portal-backend.onrender.com/api/health/
   ```
   Expected response: `{"status": "healthy", "database": "ok"}`.

---

### Step 3: Vercel Frontend Deployment
1. Log in to [Vercel](https://vercel.com) and click **"Add New..." &rarr; "Project"**.
2. Import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset:** `Other`
   - **Root Directory:** Click `Edit` and select `frontend`.
4. (Optional) Configure Environment Variable:
   - If frontend and backend are hosted on different domains, you can set `API_BASE_URL` to your Render URL:
     ```
     https://blood-bank-portal-backend.onrender.com/api
     ```
5. Click **"Deploy"**.
6. Vercel deploys the application with global CDN edge routing and clean URLs via [`frontend/vercel.json`](file:///home/kali/Projects/frontend/vercel.json).

---

### Step 4: Local Development & Demonstration Setup
To run the full stack locally on any development machine:

```bash
# 1. Clone repository
git clone https://github.com/vgnanasekaran007-hub/Blood-Bank-Management-Portal.git
cd Blood-Bank-Management-Portal

# 2. Run Backend Server
cd backend
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 seed_data.py
python3 manage.py runserver 127.0.0.1:8000

# 3. In a second terminal, Run Frontend
cd ../frontend
python3 -m http.server 3000

# 4. Open in browser: http://localhost:3000
```
