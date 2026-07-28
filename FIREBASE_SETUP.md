# Firebase Production Setup Guide

Follow these step-by-step instructions to connect FleetFlow to your customer's production Firebase project:

---

## Step 1: Create a Production Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or select an existing one).
3. Enter your project name (e.g., `fleetflow-production`), configure Google Analytics (optional), and click **Create project**.

---

## Step 2: Enable Cloud Firestore Database
1. In the Firebase Console left-hand sidebar, navigate to **Build** > **Firestore Database**.
2. Click **Create database**.
3. Choose **Production mode** (which secures access) and click **Next**.
4. Select a database location closest to your users and click **Enable**.

---

## Step 3: Register a Web Application & Get Credentials
1. On your Firebase Project Overview page, click the web icon (`</>`) to register a new web application.
2. Enter an app nickname (e.g., `fleetflow-web`) and click **Register app**.
3. Firebase will display your app configuration code. Copy only the configuration JSON key-value pairs inside the `firebaseConfig` object:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "appId": "YOUR_APP_ID",
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_AUTH_DOMAIN",
     "storageBucket": "YOUR_STORAGE_BUCKET",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID"
   }
   ```

---

## Step 4: Apply Production Credentials to the Code
1. Open the file [firebase-applet-config.json](file:///c:/Fleetflow/firebase-applet-config.json) in the project root directory.
2. Replace all the fields with your new credentials copied from the Firebase Console in Step 3.
3. If you are using the default Firestore database (which is standard), set `firestoreDatabaseId` to `""` (empty string) or delete the line:
   ```json
   {
     "projectId": "YOUR_PROJECT_ID",
     "appId": "YOUR_APP_ID",
     "apiKey": "YOUR_API_KEY",
     "authDomain": "YOUR_AUTH_DOMAIN",
     "storageBucket": "YOUR_STORAGE_BUCKET",
     "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
     "firestoreDatabaseId": ""
   }
   ```
4. Save the file. The Vite dev compiler will automatically reload the application and connect it to your production Firestore database.

---

## Step 5: Publish Firestore Security Rules
1. In the Firebase Console, go to **Firestore Database** > **Rules** tab.
2. Copy the rules from the [firestore.rules](file:///c:/Fleetflow/firestore.rules) file in your project root:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Paste them into the console rules editor and click **Publish**.
   > [!NOTE]
   > Since the terminal runs on physical driver devices without personal user logins, these public rules allow database connectivity.

---

## Step 6: Deploy / Run the Application
1. To run locally pointing to your production database, execute:
   ```bash
   npm run dev
   ```
2. To build a static production bundle for deployment (e.g., to hosting services like Firebase Hosting, Vercel, or Netlify):
   ```bash
   npm run build
   ```
   The compiled assets will be built in the `/dist` folder, ready to upload!
