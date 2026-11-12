# Linkage setup guide

The game works right away without any of this. People just play as guests and their streak is saved in that browser. Follow these steps to turn on Google sign-in, streaks on every device, and invite bonus tries.

## 1. Put the site online with Netlify
1. Make a free account at netlify.com.
2. Go to Sites, then drag the folder with `index.html` onto the page.
3. You get a link like `something.netlify.app`. Write it down.
4. Optional: buy a domain, then add it under Domain settings in Netlify.

## 2. Make a Firebase project
1. Go to console.firebase.google.com and sign in with Google.
2. Click Add project, name it `linkage`, and skip Google Analytics.

## 3. Turn on Google sign-in
1. In the left menu go to Build, then Authentication, then Get started.
2. Under Sign-in method, pick Google, flip it on, choose a support email, and save.
3. Go to Settings, then Authorized domains, and add your Netlify link and your own domain if you have one.

## 4. Turn on the database
1. Go to Build, then Firestore Database, then Create database.
2. Pick a location near you, like `us-central`, and start in production mode.
3. Open the Rules tab, delete what's there, paste everything from `firestore.rules`, and hit Publish.

## 5. Connect the game to Firebase
1. Click the gear icon, then Project settings.
2. Under Your apps, click the web icon `</>`, name it, and register. Skip Firebase Hosting.
3. Copy the `firebaseConfig` object it shows you.
4. Open `index.html` and find this line near the top of the script:
   `const FIREBASE_CONFIG = null;`
5. Replace `null` with your config, like this:
   ```
   const FIREBASE_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```
   These keys are fine to have in public code. The rules file is what keeps data safe.
6. Re-upload the folder to Netlify.

## 6. Test it
- A Sign in button shows up in the top corner. Sign in on your phone and laptop and check that your streak matches on both.
- Copy your invite link from the account panel and open it in a private window with a different Google account. Finish the daily puzzle there. Your bonus tries should go up by 1, which can take a few minutes to show.

## How streaks work
- Only the daily puzzle counts, and only if you finish it on its own day by your local midnight.
- If you haven't played today yet, your streak stays alive until midnight.
- Losing today's puzzle or skipping a day resets it to 0.
- Past puzzles from the archive are practice and never count.
- Streaks are worked out from your actual results every time, not stored as a counter, so they can't drift out of sync across devices.

## How bonus tries work
- You get 1 bonus try for each friend who signs up from your link and finishes a daily puzzle.
- A bonus try gives you a 5th mistake. It only shows up once you run out of mistakes on a daily puzzle, and you can use one per day.

## Adding puzzles
Puzzles are in the `PUZZLES` list in `index.html`. Puzzle 1 is Nov 12, 2026, and each new entry is the next day. Once you run out, they loop back to the start, so keep adding.
