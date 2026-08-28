# Firebase setup

The app works without Firebase in guest mode. Guest review progress is stored in the browser. Configure Firebase to enable accounts and cross-device synchronization.

1. Create a Firebase project and a Web app.
2. Enable Cloud Firestore.
3. In Authentication, enable Google and Email/Password providers.
4. Add the GitHub Pages hostname and `localhost` under Authentication → Settings → Authorized domains.
5. Copy `.env.example` to `.env.local` and fill in the Web app configuration.
6. Install the Firebase CLI, authenticate, select the project, and deploy the checked-in rules:

   ```sh
   firebase use --add
   firebase deploy --only firestore
   ```

For GitHub Pages, create repository secrets matching each variable in `.env.example`. The Firebase Web API key is not a server secret; access control is enforced by `firestore.rules`. Never add an Admin SDK credential or service-account key to Vite environment variables.

Review events are immutable and use client-generated UUIDs. Review state is a materialized per-feature schedule. Signing in merges newer cloud state locally and uploads guest history.
