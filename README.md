# LifeOS — Personal Productivity & Life Management System

<p align="center">
  <strong>One space to organize your goals, manage your responsibilities, and keep your life moving forward.</strong>
</p>

<p align="center">
  <a href="https://lifeos-app-1715.web.app/">
    <strong>Live Demo</strong>
  </a>
  &nbsp; • &nbsp;
  <a href="https://github.com/malakelgwaelyy/lifeOS">
    <strong>Source Code</strong>
  </a>
</p>

---

## Overview

**LifeOS** is a personal productivity and life management web application designed to bring different aspects of everyday life into one organized workspace.

Instead of switching between multiple tools to manage tasks, goals, study sessions, projects, and habits, LifeOS provides a centralized dashboard where users can plan, track, and manage their progress.

The application combines a structured productivity system with cloud-based data synchronization, allowing users to access their personal workspace through their own accounts.

## Features

### 1. Personal Dashboard
- Overview of daily activities and priorities.
- Overall progress tracking.
- Quick access to important tasks.
- Upcoming activities and study sessions.
- Daily habit checklist.

### 2. Life Areas Management
- Organize responsibilities into different life areas.
- Customize each area with its own modules.
- Track progress and outstanding tasks.
- Keep personal and professional activities structured.

### 3. Goals & Projects
- Create and manage personal goals.
- Track goal progress and milestones.
- Organize projects by life area.
- Monitor project status and completion.

### 4. Task Management
- Create, update, and organize tasks.
- Set priorities and due dates.
- Track task status.
- Identify overdue and upcoming tasks.

### 5. Study Management
- Organize academic subjects.
- Manage study sessions.
- Plan learning activities.
- Track study-related progress.

### 6. Habit Tracking
- Create and manage daily habits.
- Mark completed habits.
- Track completion history.
- Monitor consistency.

### 7. Calendar & Notes
- Manage scheduled events.
- Keep notes and important information.
- Organize resources and useful links.
- Maintain a personal workspace.

### 8. Insights & Analytics
- Visualize productivity progress.
- Monitor goals, projects, and tasks.
- Get a clearer overview of personal progress.

## Authentication & Cloud Synchronization

LifeOS integrates Firebase to provide account-based access and cloud data storage.

Key capabilities include:

- User registration and login.
- Password reset functionality.
- Firebase Authentication.
- Cloud data storage using Cloud Firestore.
- Automatic synchronization of user data.
- User-specific data organization.
- Firestore Security Rules for authenticated access.

Each user's data is stored under their own Firebase UID, helping keep individual workspaces separated.

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Styling and responsive interface |
| JavaScript | Application logic and interactions |
| Firebase Authentication | User authentication |
| Cloud Firestore | Cloud database and synchronization |
| LocalStorage | Local data persistence |
| Firebase Hosting | Application deployment |
| Git & GitHub | Version control and source code management |

## Project Structure

```text
LifeOS/
│
├── index.html
├── styles.css
│
├── app.js
├── life-os.js
│
├── firebase-config.js
├── firebase-sync.js
│
├── firestore.rules
├── firebase.json
│
├── sw.js
│
├── package.json
├── package-lock.json
│
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm.
- A Firebase project.
- Firebase Authentication enabled.
- Cloud Firestore configured.

### 1. Clone the Repository

```bash
git clone https://github.com/malakelgwaelyy/lifeOS.git
```

### 2. Navigate to the Project

```bash
cd lifeOS
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Firebase

Open `firebase-config.js` and configure your own Firebase Web App settings.

Make sure the required Firebase services are enabled in your Firebase project.

### 5. Configure Firestore Security Rules

Review the provided `firestore.rules` file and deploy the rules to your Firebase project.

### 6. Run the Application

You can serve the project locally using a local development server.

For deployment through Firebase Hosting, configure the Firebase CLI and use:

```bash
firebase deploy
```

## Security

LifeOS uses Firebase Authentication and Firestore Security Rules to protect user-specific data.

The database rules restrict access to authenticated users and their own user-specific data paths.

**Important:** Never commit private credentials, service account keys, access tokens, or environment secrets to the repository.

The Firebase Web configuration is client-side configuration and should be protected through appropriate API restrictions and Firebase security controls.

## Future Improvements

LifeOS is an evolving personal productivity project. Potential areas for further development include:

- Enhanced productivity analytics.
- More advanced planning and scheduling tools.
- Additional customization options.
- Improved user experience and accessibility.
- Expanded integrations.

## Live Application

Try LifeOS:

**[https://lifeos-app-1715.web.app/](https://lifeos-app-1715.web.app/)**

## Author

**Malak Elgwaely**

Data Science Student | Interested in Backend Development, Machine Learning & Automation.

- GitHub: [@malakelgwaelyy](https://github.com/malakelgwaelyy)
- Project Repository: [LifeOS](https://github.com/malakelgwaelyy/lifeOS)
- Live Demo: [LifeOS Web App](https://lifeos-app-1715.web.app/)

---

<p align="center">
  Built with curiosity, continuous learning, and a passion for creating useful things.
</p>
