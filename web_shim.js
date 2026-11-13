/* IT Poster Studiya — standalone web adapter.
   Provides the same window.claude.use(...) surface the studio uses on claude.ai, backed by Firebase:
   db → Cloud Firestore, user → Firebase Auth (Google), assets → images stored in Firestore (assets/{id}),
   downloads → ordinary browser download. With no Firebase config the studio runs as a local editor. */
(function () {
  "use strict";
  const CFG = window.FIREBASE_CONFIG || {};
  const ON = !!(CFG.apiKey && CFG.projectId && window.firebase);
  const blobUrl = new Map();   // asset id -> object URL
  const canonOf = new Map();   // object URL -> "/_blob/<id>"
  let fs = null, auth = null, me = null, roles = null;

  /* ---------- /_blob/<id> resolution (images live in Firestore) ---------- */
  function dataUrlToBlob(d) {
    const [h, b64] = d.split(","), mime = (h.match(/data:([^;]+)/) || [])[1] || "image/jpeg";
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: mime });
  }
  function register(id, blob) {
    if (blobUrl.has(id)) return blobUrl.get(id);
    const u = URL.createObjectURL(blob); blobUrl.set(id, u); canonOf.set(u, "/_blob/" + id); return u;
  }
  const pending = new Map();
  async function resolve(url) {
    url = String(url || "");
    const m = url.match(/\/_blob\/([A-Za-z0-9_-]+)/);
    if (!m) return url;
    const id = m[1];
    if (blobUrl.has(id)) return blobUrl.get(id);
    if (!fs) return url;
    if (!pending.has(id)) pending.set(id, fs.doc("assets/" + id).get().then(s => {
      const d = s.exists ? s.data() : null;
      return d && d.data ? register(id, dataUrlToBlob(d.data)) : url;
    }).catch(() => url));
    return pending.get(id);
  }
  async function resolveAll(str) {
    const ids = [...new Set((String(str).match(/\/_blob\/[A-Za-z0-9_-]+/g) || []))];
    for (const p of ids) { const u = await resolve(p); if (u !== p) str = str.split(p).join(u); }
    return str;
  }
  function canon(u) { return canonOf.get(u) || u; }
  function canonAll(str) { canonOf.forEach((c, u) => { if (str.includes(u)) str = str.split(u).join(c); }); return str; }
  function hydrate(root) {
    (root || document).querySelectorAll('img[src*="/_blob/"]').forEach(img => {
      const src = img.getAttribute("src"); resolve(src).then(u => { if (u !== src) img.src = u; });
    });
  }
  window.__WEB = { sample: "sample.jpg", resolve, resolveAll, canon, canonAll, hydrate, firebase: ON };

  /* ---------- image compression so one image fits a Firestore document (<1 MB) ---------- */
  function loadBitmap(blob) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(blob); });
  }
  async function compress(blob) {
    if (blob.type === "image/svg+xml") {
      const txt = await blob.text(); const d = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(txt)));
      if (d.length > 900000) throw { code: "too_large", message: "SVG 650 KB dan katta" };
      return d;
    }
    const img = await loadBitmap(blob);
    const keepAlpha = blob.type === "image/png";
    for (const max of [2400, 1800, 1400, 1080, 800]) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      for (const q of keepAlpha ? [null] : [0.86, 0.78, 0.7]) {
        const d = keepAlpha ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", q);
        if (d.length < 900000) return d;
      }
      if (keepAlpha) { const d = c.toDataURL("image/webp", 0.85); if (d.length < 900000 && d.startsWith("data:image/webp")) return d; }
    }
    throw { code: "too_large", message: "Rasmni 1 MB gacha siqib bo'lmadi" };
  }

  /* ---------- capability objects ---------- */
  const emailL = () => (me && me.email ? me.email.toLowerCase() : "");
  const inList = (l) => Array.isArray(l) && l.map(x => String(x).toLowerCase()).includes(emailL());
  const isOwner = () => !!me && !!roles && inList(roles.owners);
  const isAdmin = () => isOwner() || (!!me && !!roles && inList(roles.admins));
  const isMember = () => {
    if (!me || !roles) return false;
    if (isAdmin() || roles.anyone === true || inList(roles.members)) return true;
    const dom = emailL().split("@")[1] || "";
    return Array.isArray(roles.domains) && roles.domains.map(x => String(x).toLowerCase()).includes(dom);
  };
  const userCap = {
    id: async () => (me ? me.uid : null),
    me: async () => ({ id: me ? me.uid : null, name: me ? (me.displayName || "") : "", avatarUrl: me ? (me.photoURL || "") : "", color: "#2DD4BF", email: me ? me.email : null, isOwner: isOwner(), canEdit: isAdmin() }),
    isOwner: async () => isOwner(),
    canEdit: async () => isAdmin(),
    can: async (k) => (k === "data.write" ? isMember() : null),
    profiles: async () => ({}),
  };
  const assetsCap = {
    async upload(blob) {
      if (!fs || !isMember()) throw { code: "not_granted", message: "Rasm yuklash uchun kirish kerak" };
      const data = await compress(blob);
      const ref = fs.collection("assets").doc();
      await ref.set({ data, type: data.slice(5, data.indexOf(";")), createdBy: me.uid, createdAt: new Date().toISOString() });
      const url = register(ref.id, dataUrlToBlob(data));
      return { id: ref.id, url, sizeBytes: Math.round(data.length * 0.75), contentType: data.slice(5, data.indexOf(";")) };
    },
    async list() { return { assets: [], usage: { files: 0, bytes: 0, maxFiles: 0, maxBytes: 0 } }; },
    async delete(id) { await fs.doc("assets/" + id).delete(); return { deleted: true }; },
  };
  const downloadsCap = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = filename || "poster"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      return { status: "saved" };
    },
  };

  /* ---------- boot: wait for the first auth state ---------- */
  let ready;
  if (ON) {
    firebase.initializeApp(CFG);
    fs = firebase.firestore();
    try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}
    auth = firebase.auth();
    ready = new Promise(res => {
      const off = auth.onAuthStateChanged(async u => {
        off(); me = u || null;
        if (me) {
          try { const s = await fs.doc("config/roles").get(); roles = s.exists ? s.data() : null; } catch (e) { roles = {}; }
          if (roles === null) {
            // first sign-in by the project owner: the rules let only the owner create the roles document
            const em = (me.email || "").toLowerCase(), dom = em.split("@")[1] || "";
            const seed = { owners: [em], admins: [], members: [], domains: dom ? [dom] : [], anyone: false };
            try { await fs.doc("config/roles").set(seed); roles = seed; } catch (e) { roles = {}; }
          }
        }
        res();
      });
    });
  } else ready = Promise.resolve();

  window.claude = {
    use(name) {
      return ready.then(() => {
        if (name === "downloads") return downloadsCap;
        if (!ON) return null;
        if (name === "user") return userCap;
        if (!me) return null;
        if (name === "db") return fs;
        if (name === "assets") return isMember() ? assetsCap : null;
        return null;
      });
    },
  };

  /* ---------- sign-in / sign-out control in the top bar ---------- */
  function mountAuthUI() {
    const top = document.querySelector(".top"); if (!top) return;
    const box = document.createElement("div"); box.className = "authbox";
    if (!ON) {
      box.innerHTML = '<span class="runinfo" title="firebase-config.js to\'ldirilmagan">Mahalliy rejim</span>';
    } else if (!me) {
      box.innerHTML = '<button class="btn pri" id="wSignIn" type="button">Google bilan kirish</button>';
    } else {
      const nm = ((me.displayName || "").split(" ")[0] || (me.email || "").split("@")[0]).replace(/[<>&"]/g, "");
      box.innerHTML = `<span class="runinfo" title="${me.email || ""}"><i>${nm}</i>${isOwner() ? " · egasi" : isAdmin() ? " · muharrir" : isMember() ? "" : " · ruxsat yo'q"}</span><button class="btn" id="wSignOut" type="button">Chiqish</button>`;
    }
    top.appendChild(box);
    const si = box.querySelector("#wSignIn"), so = box.querySelector("#wSignOut");
    if (si) si.addEventListener("click", () => {
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      auth.signInWithPopup(p).then(() => location.reload()).catch(e => {
        if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) auth.signInWithRedirect(p);
        else if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") alert("Kirib bo'lmadi: " + (e.message || e.code));
      });
    });
    if (so) so.addEventListener("click", () => auth.signOut().then(() => location.reload()));
  }
  ready.then(() => { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAuthUI); else mountAuthUI(); });
})();
