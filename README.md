# Smart Job Tracker (SJT)
<img width="1053" height="1272" alt="image" src="https://github.com/user-attachments/assets/6022eeb7-83ad-4c65-a2f5-e6774d37cdf0" />

Fullstack project to track job applications.  
Built as a portfolio piece to demonstrate **development + DevOps skills**.



## 🛠️ Tech Stack

**Frontend**  
- React (Vite, TailwindCSS, Zustand)  
- Recharts  

**Backend**  
- Node.js (Express)  
- JWT Auth (Access/Refresh tokens)  
- bcrypt password hashing  

**Database**  
- PostgreSQL  

**DevOps**  
- Docker (multi-stage builds)  
- GitHub Container Registry (GHCR)  
- GitHub Actions  
- Kubernetes (Minikube)
- 
<img width="1052" height="587" alt="image" src="https://github.com/user-attachments/assets/4323ddee-d15f-42d3-b462-ed5ca402e6b7" />

---

## 🚀 Features

### Core App
- **Authentication & Multi-user support**  
  - Register, Login, JWT Access + Refresh tokens  
  - Password hashing with bcrypt  
- **Job Tracking CRUD**  
  - Company, role, source, location  
  - Notes per job (free text)  
- **Filters & Search**  
  - By status / free text  
- **Visualizations**  
  - Pie chart distribution of job statuses with Recharts  
- **UI**  
  - React + Tailwind, clean responsive dashboard  

### DevOps
- **Dockerized (multi-stage builds)**  
  - Client (React + Vite → Nginx)  
  - Server (Node.js + Express + PostgreSQL driver)  
- **PostgreSQL Database**  
  - User isolation per `user_id`  
- **GitHub Actions (CI/CD)**  
  - Build & push Docker images to GHCR (`sjt-client`, `sjt-server`)  
- **Kubernetes (via Minikube)**  
  - Deployments + Services (`api`, `web`, `postgres`)  
  - ConfigMap + Secrets  
  - Horizontal Pod Autoscaler (HPA)  
  - PodDisruptionBudget (PDB)  
  - Auto-healing ReplicaSets + `rollout restart`  

---


