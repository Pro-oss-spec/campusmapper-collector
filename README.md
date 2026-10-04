# CampusMapper Collector (Version 1)

Walk to a campus building, enter its name, capture GPS, take photos, add notes, save, then see it in the collection and on the map.

Built with React, Vite, JavaScript, Supabase (PostgreSQL + Storage) and Leaflet. No login in this version.

## 1. Project structure

```
campusmapper-collector/
  .env.example            copy to .env and add your Supabase keys
  .gitignore
  index.html              page shell, fonts, mobile viewport
  package.json            dependencies and scripts
  vite.config.js          Vite setup (includes HTTPS for phone testing)
  public/
    favicon.svg
  supabase/
    schema.sql            tables, security rules, storage bucket, starter data
  src/
    main.jsx              starts React
    App.jsx               routes and loading/setup screens
    index.css             all styling
    context/
      AppContext.jsx      shares campuses, categories and the current campus
    lib/
      supabase.js         Supabase client (reads your .env keys)
      location.js         GPS capture, accuracy rules, photo types, formatting
      storage.js          photo compression, upload and delete
      places.js           create, read, update, delete for places and photos
    components/
      Header.jsx
      LocationForm.jsx    campus, name, category, description, notes
      GPSCapture.jsx      Capture GPS button, readout, warnings
      PhotoCapture.jsx    one photo slot (take, select, preview, retake, remove)
      PhotoGrid.jsx       the five photo slots
      LocationCard.jsx    card used in the collection list
      MapView.jsx         Leaflet map with named markers
    pages/
      Dashboard.jsx
      NewLocation.jsx     5 steps: Details, GPS, Photos, Notes, Review and Save
      Collection.jsx      list and map views
      LocationDetails.jsx view, edit and delete one location
```

## 2. Set up Supabase (database and storage)

1. Create a free project at supabase.com.
2. Open **SQL Editor > New query**, paste everything from `supabase/schema.sql`, and press **Run**.
   This creates the four tables, the security rules, the `campus-photos` storage bucket and its rules, and some starter categories.
3. Still in the SQL Editor, change the starter campus to your real one. Replace the name and coordinates:

   ```sql
   update public.campuses
   set name = 'University of Uyo', center_lat = 5.0000, center_lng = 7.9000
   where name = 'My University';
   ```

   To get coordinates, long-press the middle of campus in Google Maps. To add more campuses, insert more rows into `campuses`.
4. Check **Storage** in the left menu. You should see a bucket named `campus-photos`.

Photos are saved as `campus-photos/<campus-id>/<place-id>/front.jpg`, `entrance.jpg`, `surroundings.jpg`, `sign.jpg` and `other.jpg`.

## 3. Environment variables

1. In Supabase open **Project Settings > API**.
2. Copy the **Project URL** and the **anon public** key.
3. In the project folder, copy `.env.example` to `.env` and paste them in:

   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

Never put the `service_role` key in this app. `.env` is already in `.gitignore`.

## 4. Install and run

You need Node.js 18 or newer.

```bash
cd campusmapper-collector
npm install
npm run dev
```

The terminal prints two addresses, **Local** and **Network**. Open the Network one (for example `https://192.168.1.20:5173`) on your phone while it is on the same Wi-Fi as your computer.

Your browser will warn that the certificate is not trusted. That is expected for local testing. Tap **Advanced** and continue. Phones only allow GPS and camera features on HTTPS pages, which is why this step matters.

If you prefer to build the project from scratch instead of using these files:

```bash
npm create vite@latest campusmapper-collector -- --template react
cd campusmapper-collector
npm install @supabase/supabase-js leaflet react-router-dom
npm install -D @vitejs/plugin-basic-ssl
```

Then copy the files from this project over the generated ones.

## 5. Deploy so you can use it on campus

Phone data is better than local Wi-Fi in the field. Deploy the `dist` build to Netlify, Vercel or Cloudflare Pages:

```bash
npm run build
```

Add the same two `VITE_` variables in the host's settings. The app uses hash routing (`/#/collection`), so no extra redirect rules are needed.

## 6. Testing checklist

Do these on a real phone, outdoors.

1. **Setup**: the dashboard opens and shows your campus. If you see "Connect Supabase", check `.env` and restart `npm run dev`.
2. **Details**: enter a name, pick a category. Next stays disabled until both are set.
3. **GPS**: tap Capture GPS. Allow location. Latitude, longitude and accuracy appear. Tap Use this reading when the accuracy looks good.
4. **GPS errors**: block location for the site in browser settings and tap Capture GPS. A clear message appears. Allow it again and retry.
5. **Weak GPS**: capture indoors. If accuracy is worse than 25 m you see a warning and can recapture.
6. **Photos**: for each slot try Take Photo (rear camera opens) and Select Photo (gallery opens). Check Retake and Remove.
7. **Review**: all details show, and Change jumps back to the right step.
8. **Save**: tap Save Location. You see "Uploading photo 1 of N", then the success screen.
9. **Supabase**: Table Editor shows the new row in `places` and rows in `place_photos`. Storage shows the folder with your photos.
10. **Collection**: the card shows thumbnail, name, category, campus, coordinates and date. Search and the campus filter work.
11. **Map**: switch to Map. Your marker shows its name, and tapping it shows a popup with Open record. Use the layers button to switch to satellite.
12. **Edit**: open a record, tap Edit Location, change the name, recapture GPS, replace one photo, remove another, save.
13. **Delete**: tap Delete Location and confirm. The record disappears and its photos are gone from Storage.

## Notes and limits for Version 1

- **No login.** The security rules allow anyone with your app's anon key to read and write places and photos. Keep the app link within your team until you add authentication, then tighten the policies in `schema.sql`.
- **No offline mode.** If you lose signal, your entries stay on screen so you can retry the save, but they are not stored on the phone. Do not close the tab until saving succeeds.
- **One photo per slot.** Each of the five slots holds one photo. Retaking replaces the old one.
- Photos are shrunk to 1600 px on the long side before upload to save mobile data.
