# Delivery Platform 🚚

A modern delivery and logistics web application that allows customers to book deliveries, track packages in real time, and drivers to earn flexibly on their own schedule.

---

# 🚀 Features

## Customer Features

* Create delivery requests
* Real-time package tracking
* Secure authentication
* Delivery history
* Responsive mobile-friendly UI

## Driver Features

* Register as a driver
* Accept delivery requests
* Manage active deliveries
* Flexible working schedule

## Admin Features

* Manage users and drivers
* Monitor deliveries
* Platform analytics
* Secure admin access

---

# 🛠️ Tech Stack

Frontend:

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Lucide Icons

Backend / Services:

* Firebase Authentication
* Firebase Database / Firestore
* Firebase Storage (if needed)

---

# 📦 Installation & Setup

## 1️⃣ Clone Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_NAME>
```

## 2️⃣ Install Dependencies

```bash
npm install
```

## 3️⃣ Run Development Server

```bash
npm run dev
```

App will start on:

```
http://localhost:5173
```

---

# 🔥 Firebase Setup

Create a Firebase project and enable:

* Authentication (Email/Password)
* Firestore Database
* Storage (optional)

Then create a `.env` file:

```
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

# 📁 Project Structure

```
src/
 ├── components/
 ├── pages/
 ├── hooks/
 ├── services/
 ├── lib/
 ├── App.tsx
 └── main.tsx
```

---

# 🧪 Build for Production

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

# 🌐 Deployment

You can deploy easily using:

* Firebase Hosting
* Vercel
* Netlify

---

# 🔐 Admin Access

Admin panel access is protected.

(You can customize authentication logic inside the project.)

---

# 📱 Responsive Design

The application is fully responsive and optimized for:

* Mobile
* Tablet
* Desktop

---

# 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

# 📄 License

This project is licensed under the MIT License.
