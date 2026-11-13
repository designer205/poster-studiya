# IT Poster Studiya — veb versiya

Poster muharriri, yo'nalishlar, galereya va fon rasmlari navbati. Sayt GitHub Pages'da turadi, ma'lumotlar Firebase'da saqlanadi. Kirish Google hisobi orqali.

Papkadagi fayllar:

| Fayl | Nima |
|---|---|
| `index.html` | Studiyaning o'zi |
| `firebase-config.js` | Firebase loyihangiz sozlamalari (1-qadamda to'ldirasiz) |
| `web_shim.js` | Studiyani Firebase'ga ulaydigan qism |
| `firestore.rules` | Ma'lumotlar bazasi xavfsizlik qoidalari |
| `sample.jpg` | Namunaviy fon rasmi |
| `.nojekyll` | GitHub Pages uchun xizmat fayli (yashirin bo'lishi mumkin) |

---

## 1. Firebase loyihasi (10 daqiqa)

1. https://console.firebase.google.com sahifasini oching → **Create a project** (masalan, `poster-studiya`). Google Analytics shart emas.
2. **Web app qo'shish:** loyiha bosh sahifasida `</>` belgisini bosing → nom bering → **Register app**. Chiqqan `firebaseConfig` obyektidagi qiymatlarni `firebase-config.js` fayliga ko'chiring (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).
3. **Kirish (Authentication):** chap menyu → **Build → Authentication → Get started → Sign-in method → Google → Enable** → support email tanlang → **Save**.
4. **Ma'lumotlar bazasi (Firestore):** **Build → Firestore Database → Create database** → joylashuv (masalan, `eur3`) → **Start in production mode**.
5. **Qoidalar:** Firestore → **Rules** yorlig'i → ichidagini to'liq o'chirib, `firestore.rules` faylidagi matnni qo'ying → **Publish**.
6. **Rollar:** Firestore → **Data** → **Start collection** → Collection ID: `config` → Document ID: `roles` → quyidagi maydonlarni qo'shing:

| Maydon | Turi | Qiymat |
|---|---|---|
| `owners` | array | o'z emailingiz, kichik harflarda |
| `admins` | array | muharrirlar emaillari (bo'sh bo'lishi mumkin) |
| `domains` | array | `stonexholding.com` — shu domendagi hamma a'zo bo'ladi |
| `members` | array | domendan tashqaridagi alohida odamlar (bo'sh bo'lishi mumkin) |
| `anyone` | boolean | `false` |

Huquqlar:
- **owners** — hamma narsa, "Hozir generatsiya" tugmasi ko'rinadi.
- **admins** — posterlarni o'chirish, panjara qoidasini saqlash.
- **a'zolar** (domains / members) — galereyani ko'rish, saqlash, rasm so'rovi yuborish, rasm yuklash.
- Boshqalar kirsa ham faqat muharrir va eksport ishlaydi.

Rollarni keyin ham shu hujjatda o'zgartirasiz.

## 2. GitHub Pages'ga joylash (5 daqiqa)

1. https://github.com/new → Repository name: `poster-studiya` → **Public** → **Create repository**.
2. Ochilgan sahifada **uploading an existing file** havolasini bosing (yoki **Add file → Upload files**).
3. Shu papkadagi **barcha fayllarni** (papkaning o'zini emas) sudrab tashlang → **Commit changes**.
   `.nojekyll` yashirin fayl ko'rinmasa, uni yuklamasangiz ham sayt ishlaydi.
4. Repozitoriyda **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, papka `/ (root)` → **Save**.
5. 1–2 daqiqadan keyin manzil chiqadi: `https://<github-login>.github.io/poster-studiya/`

## 3. Domenni Firebase'ga tanitish

Firebase → **Authentication → Settings → Authorized domains → Add domain** → `<github-login>.github.io` → **Add**.
Busiz "Google bilan kirish" tugmasi xato beradi.

Tayyor. Saytni oching → **Google bilan kirish** → studiya ishlaydi.

---

## Keyinchalik

- **O'z domeningiz** (masalan, `poster.stonexholding.com`): GitHub → Settings → Pages → Custom domain, DNS'da CNAME yozuvi `<github-login>.github.io` ga. Keyin bu domenni ham Firebase Authorized domains'ga qo'shing.
- **Yangilash:** yangi `index.html` kelganda GitHub'da faylni ochib, **Upload files** bilan ustidan yuklaysiz. `firebase-config.js` faylini qayta yuklamang, u sizniki.
- **Rasmlar** Firestore'da saqlanadi: har biri 1 MB gacha siqiladi. Bepul Spark tarifi 1 GB va kuniga 50 000 o'qishgacha yetadi.
- **Bepul tarif:** Firebase Storage kerak emas, Blaze tarifiga o'tish shart emas.
