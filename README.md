# Smart Job Tracker (SJT)

Full-stack and DevOps project for tracking job applications.  
Built to demonstrate practical skills in backend development, containerization, CI/CD, orchestration, and cloud deployment (AWS).

<img width="1053" height="1272" alt="image" src="https://github.com/user-attachments/assets/6022eeb7-83ad-4c65-a2f5-e6774d37cdf0" />
---

## Tech Stack

### Frontend
- **React (Vite), TailwindCSS**
- **Zustand** for state management  
- **Recharts** for data visualization  

### Backend
- **Node.js (Express)**  
- REST API architecture  
- **JWT authentication** (access + refresh tokens)  
- **bcrypt** password hashing  
- Centralized error handling and middleware structure

### Database
- **PostgreSQL**  
- Relational schema with user-scoped data isolation  
- Indexed, normalized tables

### DevOps / Cloud
- **Docker** (multi-stage builds)  
- **GitHub Actions** for CI/CD  
- **GitHub Container Registry (GHCR)** for image storage  
- **Kubernetes** (Minikube + production manifests)  
- **AWS EC2** deployment  
- **Nginx** reverse proxy for production serving

---

## Features

### Authentication
- Registration & login  
- Access + Refresh token flow  
- Password hashing and secure validation  
- Token rotation and invalidation support  

### Job Management
- Create, update, delete, and view job applications  
- Notes per job  
- Status categories (Applied, Interview, Offer, etc.)  
- Text search and filtering

### Dashboard
- Pie chart visualization for job status distribution  
- Responsive UI built with Tailwind  
- Real-time state updates using Zustand  

---

## DevOps Details

### Docker
- Multi-stage build for client (React → Nginx)  
- Multi-stage build for server (Node.js alpine)  
- Environment variable injection for production  
- Optimized image sizes and caching  

### Kubernetes
- Deployments + Services for:
  - `api`
  - `web`
  - `postgres`
- ConfigMap + Secret manifests  
- Liveness & Readiness probes  
- Horizontal Pod Autoscaler (HPA)  
- PodDisruptionBudget (PDB)  
- Rolling updates and automatic pod recovery  

### CI/CD (GitHub Actions)
Pipeline includes:
- Build + test steps for client and server  
- Docker image builds for both services  
- Automated pushes to GHCR  
- Tagged release workflow  
- Optional deployment triggers for AWS or Minikube  

---

## AWS Deployment
- Hosted on **AWS EC2** Ubuntu instance  
- Nginx reverse proxy for routing traffic to Kubernetes cluster  
- Secure environment variables  
- Persistent PostgreSQL volume  
- Firewall + security group configuration

---

## Repository Structure (Simplified)
```
/client        # React frontend
/server        # Node.js backend
/k8s           # Kubernetes manifests (Dev & Prod)
/scripts       # Utility scripts for builds & deployment
```

---

## Purpose
The project serves as a full demonstration of:
- Backend engineering
- JWT-based authentication
- Database schema design
- CI/CD automation
- Containerization & orchestration
- Real cloud deployment on AWS

<img width="1052" height="587" alt="image" src="https://github.com/user-attachments/assets/4323ddee-d15f-42d3-b462-ed5ca402e6b7" />
