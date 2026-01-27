"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface Star {
  position: [number, number, number];
  size: number;
  speed: number;
  twinkleOffset: number;
}

function Stars({ count = 80 }: { count?: number }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport, mouse } = useThree();

  // Generate star data
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: count }, () => ({
      position: [
        (Math.random() - 0.5) * viewport.width * 2.5,
        (Math.random() - 0.5) * viewport.height * 2.5,
        (Math.random() - 0.5) * 10 - 5,
      ] as [number, number, number],
      size: Math.random() * 0.03 + 0.01,
      speed: Math.random() * 0.0005 + 0.0002,
      twinkleOffset: Math.random() * Math.PI * 2,
    }));
  }, [count, viewport]);

  // Colors for stars
  const colors = useMemo(() => {
    const goldColors = [
      new THREE.Color("#C9A227"),
      new THREE.Color("#E8D48A"),
      new THREE.Color("#FFFFFF"),
      new THREE.Color("#F0E2A3"),
    ];
    return stars.map(() => goldColors[Math.floor(Math.random() * goldColors.length)]);
  }, [stars]);

  // Dummy object for matrix calculations
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Animation
  useFrame((state) => {
    if (!mesh.current) return;

    const time = state.clock.getElapsedTime();

    stars.forEach((star, i) => {
      // Base position with drift
      const x = star.position[0] + Math.sin(time * star.speed * 10) * 0.1;
      const y = star.position[1] + time * star.speed * 5;
      const z = star.position[2];

      // Parallax effect based on mouse
      const parallaxX = mouse.x * 0.3 * (z + 10) * 0.05;
      const parallaxY = mouse.y * 0.3 * (z + 10) * 0.05;

      dummy.position.set(x + parallaxX, y + parallaxY, z);

      // Twinkle effect
      const twinkle = Math.sin(time * 2 + star.twinkleOffset) * 0.5 + 0.5;
      const scale = star.size * (0.5 + twinkle * 0.5);
      dummy.scale.setScalar(scale);

      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);

      // Update color with twinkle
      const color = colors[i].clone();
      color.multiplyScalar(0.5 + twinkle * 0.5);
      mesh.current!.setColorAt(i, color);
    });

    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) {
      mesh.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <circleGeometry args={[1, 8]} />
      <meshBasicMaterial transparent opacity={0.9} />
    </instancedMesh>
  );
}

export function StarField({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if mobile for reduced star count
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!mounted) {
    return (
      <div className={className}>
        {/* Fallback static stars for SSR */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-gold-400 opacity-50 animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Fewer stars on mobile for better performance
  const starCount = isMobile ? 30 : 80;

  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        style={{ background: "transparent" }}
        dpr={isMobile ? 1 : [1, 2]}
      >
        <Stars count={starCount} />
      </Canvas>
    </div>
  );
}
