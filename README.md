# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`

2. Set up environment variables:
   Create a `.env.local` file in the root directory and add:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Run the app:
   `npm run dev`

## First Time Setup

When you first run the app, you'll need to create an account:

1. Click on "Créer un compte" (Create Account) in the authentication modal
2. Enter your email and password
3. Click "Créer un compte" to register

After creating your account, you can sign in with the same credentials.

## Troubleshooting

- **Invalid login credentials**: Make sure you have created an account first using the sign-up option
- **Supabase connection issues**: Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set in `.env.local`