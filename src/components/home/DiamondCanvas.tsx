"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Brilliant-cut silhouette spun on a lathe; flat shading gives faceted planes. */
function Gem({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const profile = [
      new THREE.Vector2(0, -1.15), // culet
      new THREE.Vector2(1.0, 0.05), // girdle
      new THREE.Vector2(1.0, 0.12),
      new THREE.Vector2(0.62, 0.52), // crown
      new THREE.Vector2(0, 0.52), // table
    ];
    const g = new THREE.LatheGeometry(profile, 16);
    g.computeVertexNormals();
    return g;
  }, []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.rotation.y += dt * 0.25;
  });

  return (
    <group ref={group} rotation={[0.35, 0, 0.12]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#FBFAF7" metalness={0.15} roughness={0.08} flatShading transparent opacity={0.55} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

export default function DiamondCanvas({ color }: { color: string }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      aria-hidden
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} />
      <Gem color={color} />
    </Canvas>
  );
}
