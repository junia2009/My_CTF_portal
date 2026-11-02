// PALLAS の 3D 表示（three.js）。モデルにアニメーションは無いので、各パーツをプログラムで動かす
import * as THREE from '../../vendor/three/three.module.min.js';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';

const MOODS = {
  idle: { eye: 1, orbit: 0.5, bob: 1 },
  talk: { eye: 1.6, orbit: 0.7, bob: 1 },
  happy: { eye: 2.2, orbit: 2.4, bob: 1.8 },
  think: { eye: 0.9, orbit: 1.8, bob: 0.6 },
  alert: { eye: 2, orbit: 1, bob: 0.4 },
};

export async function createDrone(container, { modelUrl, reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xcfeaff, 0x0a1626, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0x36e6ff, 6, 10);
  rim.position.set(-2, 1, -2);
  scene.add(rim);

  const gltf = await new GLTFLoader().loadAsync(modelUrl);
  const root = gltf.scene.getObjectByName('PALLAS') ?? gltf.scene;
  scene.add(gltf.scene);
  const part = (n) => gltf.scene.getObjectByName(n);
  const face = part('face'), finL = part('finL'), finR = part('finR'), orbit = part('orbit');
  const thrusterGlow = part('thruster_glow');
  // 各パーツの元の傾きを覚えておき、アニメーションは差分として足す
  const base = new Map([face, finL, finR, orbit].filter(Boolean).map((o) => [o, o.rotation.clone()]));
  const setRot = (o, dx, dy, dz) => {
    if (!o) return;
    const b = base.get(o);
    o.rotation.set(b.x + dx, b.y + dy, b.z + dz);
  };
  let orbitAngle = 0;

  // 色を変える材質は複製して独立させる（目・光るパーツ）
  const glowMats = new Set();
  let eyeMat = null;
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.name === 'eye') {
      o.material = o.material.clone();
      eyeMat = o.material;
    } else if (o.material.name === 'cyan_glow') glowMats.add(o.material);
  });
  const baseEyeIntensity = eyeMat?.emissiveIntensity ?? 1;
  const baseGlowIntensity = [...glowMats][0]?.emissiveIntensity ?? 1;

  // カメラをモデル全体が収まる位置に置く
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.86;
  camera.position.set(sphere.center.x, sphere.center.y + sphere.radius * 0.18, sphere.center.z + dist);
  camera.lookAt(sphere.center);

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // ---- 状態 ----
  let mood = 'idle', moodUntil = 0, talking = false;
  const look = new THREE.Vector2(), lookTarget = new THREE.Vector2();
  const accent = new THREE.Color(0x36e6ff), warn = new THREE.Color(0xffc247);
  let spin = 0; // happy のときの回転
  const motion = new THREE.Vector2(), motionTarget = new THREE.Vector2(); // 画面上の移動速度（px/秒）
  const baseRot = root.rotation.clone();

  function applyAccent(css) {
    accent.set(css);
    for (const m of glowMats) m.emissive?.copy(accent);
    rim.color.copy(accent);
  }

  const clock = new THREE.Clock();
  let raf = 0, running = false;
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (moodUntil && t > moodUntil) {
      mood = talking ? 'talk' : 'idle';
      moodUntil = 0;
    }
    const M = MOODS[mood];

    // 目がポインタを追う
    look.lerp(lookTarget, 0.08);

    // 浮遊・揺れ
    root.position.y = Math.sin(t * 1.7) * 0.06 * M.bob;
    // 移動中は進む方向へ機体を傾ける（左右はバンク、上下はピッチ）
    motion.lerp(motionTarget, 0.12);
    const bank = THREE.MathUtils.clamp(-motion.x / 1400, -0.5, 0.5);
    const pitch = THREE.MathUtils.clamp(motion.y / 1800, -0.35, 0.35);
    root.rotation.z = baseRot.z + Math.sin(t * 1.1) * 0.05 + bank;
    if (mood === 'happy') spin += dt * 7;
    else spin *= 0.9;
    // 体ごと少しポインタの方を向く（顔だけを大きく回すと球体にめり込むため）
    root.rotation.y = baseRot.y + Math.sin(spin) * 0.6 + look.x * 0.45;
    root.rotation.x = baseRot.x - look.y * 0.25 + pitch;
    if (mood === 'alert') root.position.x = Math.sin(t * 40) * 0.015;
    else root.position.x = 0;

    // シールド板の周回（リングの法線＝ローカル Z 軸まわり）
    orbitAngle += dt * M.orbit;
    setRot(orbit, 0, 0, orbitAngle);

    // ヒレのはばたき
    const flap = Math.sin(t * (mood === 'happy' ? 12 : 3)) * (mood === 'happy' ? 0.35 : 0.12);
    setRot(finL, 0, 0, flap);
    setRot(finR, 0, 0, -flap);

    setRot(face, -look.y * 0.12, look.x * 0.16, 0);

    // 目の発光（話している間は明滅）
    if (eyeMat) {
      const pulse = talking ? 0.75 + 0.25 * Math.abs(Math.sin(t * 14)) : 1;
      eyeMat.emissiveIntensity = baseEyeIntensity * M.eye * pulse;
      eyeMat.emissive.copy(mood === 'alert' ? warn : accent);
    }
    for (const m of glowMats) m.emissiveIntensity = baseGlowIntensity * (0.85 + 0.15 * Math.sin(t * 2.3));
    const boost = Math.min(motion.length() / 900, 0.8);
    if (thrusterGlow) thrusterGlow.scale.setScalar(0.9 + boost + 0.12 * Math.sin(t * 23) + 0.05 * Math.sin(t * 7));

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  const start = () => {
    if (running || reducedMotion) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const renderOnce = () => {
    if (!running) frame();
  };
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  start();
  renderOnce();

  return {
    setMood(m, seconds = 2.5) {
      if (!MOODS[m]) return;
      mood = m;
      moodUntil = clock.elapsedTime + seconds;
      renderOnce();
    },
    setTalking(on) {
      talking = on;
      if (mood === 'idle' || mood === 'talk') mood = on ? 'talk' : 'idle';
    },
    // x, y は -1〜1（画面上のポインタ位置をドローンから見た方向に正規化したもの）
    lookAt(x, y) {
      lookTarget.set(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y)));
    },
    setMotion(vx, vy) {
      motionTarget.set(vx, vy);
    },
    setAccent(css) {
      applyAccent(css);
      renderOnce();
    },
    dispose() {
      stop();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
