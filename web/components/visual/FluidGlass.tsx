"use client";

/* DiamondAI — FluidGlass lens hero flourish (adapted from React Bits FluidGlass).
   Keeps the component's core: the lens.glb geometry + MeshTransmissionMaterial
   refracting an offscreen (FBO) scene. Trimmed to a single contained, transparent,
   pointer-following lens that drifts over a soft MLB red/blue field — no scroll
   hijacking, no remote fonts. Lazy/client-only with a static fallback (see hero). */
import * as THREE from "three";
import { useMemo, useRef, useState } from "react";
import { Canvas, createPortal, useFrame, useThree } from "@react-three/fiber";
import { useFBO, useGLTF, MeshTransmissionMaterial, Preload } from "@react-three/drei";
import { useReducedMotion } from "motion/react";
import { easing } from "maath";

useGLTF.preload("/assets/3d/lens.glb");

// Soft radial sprite (white→transparent) generated once, tinted per-blob.
function useGlowTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.5, "rgba(255,255,255,0.45)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

// The field the lens refracts: a few slow-drifting colored glows.
function SoftField({ tint }: { tint: { color: string; pos: [number, number]; scale: number; speed: number }[] }) {
  const tex = useGlowTexture();
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      const s = tint[i];
      if (!s) return;
      child.position.x = s.pos[0] + Math.sin(t * s.speed + i) * 0.7;
      child.position.y = s.pos[1] + Math.cos(t * s.speed * 0.8 + i) * 0.5;
    });
  });
  return (
    <group ref={group}>
      {tint.map((s, i) => (
        <mesh key={i} position={[s.pos[0], s.pos[1], -1 - i * 0.2]} scale={s.scale}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={tex}
            color={s.color}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Lens({
  children,
  scale = 0.25,
  ior = 1.15,
  thickness = 5,
  chromaticAberration = 0.1,
  anisotropy = 0.01,
}: {
  children: React.ReactNode;
  scale?: number;
  ior?: number;
  thickness?: number;
  chromaticAberration?: number;
  anisotropy?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { nodes } = useGLTF("/assets/3d/lens.glb");
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState(() => new THREE.Scene());
  const geometry = (nodes.Cylinder as THREE.Mesh | undefined)?.geometry;

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera, clock } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    const t = clock.elapsedTime;
    // pointer-follow + a gentle autonomous drift (so it lives on load / mobile)
    const destX = (pointer.x * v.width) / 2 + Math.sin(t * 0.35) * v.width * 0.12;
    const destY = (pointer.y * v.height) / 2 + Math.cos(t * 0.28) * v.height * 0.1;
    if (ref.current) easing.damp3(ref.current.position, [destX, destY, 15], 0.2, delta);

    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  return (
    <>
      {createPortal(children, scene)}
      <mesh scale={[vp.width, vp.height, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={buffer.texture} transparent opacity={0.85} />
      </mesh>
      {geometry && (
        <mesh ref={ref} scale={scale} rotation-x={Math.PI / 2} geometry={geometry}>
          <MeshTransmissionMaterial
            buffer={buffer.texture}
            ior={ior}
            thickness={thickness}
            anisotropy={anisotropy}
            chromaticAberration={chromaticAberration}
            roughness={0}
            transmission={1}
          />
        </mesh>
      )}
    </>
  );
}

export default function FluidGlass({ tint }: { tint: { color: string; pos: [number, number]; scale: number; speed: number }[] }) {
  const reduce = useReducedMotion();
  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true }} dpr={[1, 2]} frameloop={reduce ? "demand" : "always"}>
      <Lens>
        <SoftField tint={tint} />
      </Lens>
      <Preload all />
    </Canvas>
  );
}
