'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Shape, CanvasTexture, SRGBColorSpace, MathUtils, PCFShadowMap } from 'three';

function roundedShape(width, height, radius) {
  const x = -width / 2,
    y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function Tile({ width = 3, height = 2, color, depth = 0.16, ...props }) {
  const shape = useMemo(() => roundedShape(width, height, 0.17), [width, height]);
  return (
    <mesh castShadow receiveShadow {...props}>
      <extrudeGeometry
        args={[
          shape,
          {
            depth,
            bevelEnabled: true,
            bevelSegments: 3,
            steps: 1,
            bevelSize: 0.07,
            bevelThickness: 0.07,
            curveSegments: 12,
          },
        ]}
      />
      <meshPhysicalMaterial color={color} roughness={0.29} metalness={0.08} clearcoat={0.5} />
    </mesh>
  );
}

function ProductLabel({ product, position }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 768, 384);
    ctx.fillStyle = '#24242a';
    ctx.font = 'bold 78px Arial';
    ctx.fillText(product?.name || 'a good find', 40, 173, 680);
    ctx.font = '28px Arial';
    ctx.fillText(product?.category || 'something worth a tab', 44, 233, 660);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [product?.name, product?.category]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position}>
      <planeGeometry args={[2.1, 1.05]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

function World({ progress, gobble, active, product, onSelect, boops, palette }) {
  const world = useRef(),
    creature = useRef(),
    floating = useRef(),
    ring = useRef(),
    mouth = useRef(),
    smile = useRef();
  const pupils = useRef([]);
  const spring = useRef({ position: 0, velocity: 0 });
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (boops > 0) spring.current.velocity = 9;
  }, [boops]);
  useFrame(({ clock, pointer }, delta) => {
    if (!active) return;
    const t = clock.getElapsedTime(),
      p = progress.current,
      bite = gobble.current;
    const ease = 1 - Math.exp(-delta * 4);
    world.current.rotation.y = MathUtils.lerp(
      world.current.rotation.y,
      pointer.x * 0.13 + p * 0.32,
      ease,
    );
    world.current.rotation.x = MathUtils.lerp(world.current.rotation.x, -pointer.y * 0.07, ease);
    world.current.position.y = -p * 0.35;
    const dt = Math.min(delta, 1 / 30);
    spring.current.velocity += (-105 * spring.current.position - 12 * spring.current.velocity) * dt;
    spring.current.position += spring.current.velocity * dt;
    const bounce = spring.current.position;
    creature.current.scale.set(1 + bounce * 0.2, 1 - bounce * 0.2, 1 + bounce * 0.08);
    creature.current.position.y = Math.sin(t * 1.3) * 0.075 + bounce * 0.12;
    creature.current.rotation.z = -0.15 + Math.sin(t * 0.7) * 0.035 + bounce * 0.1;
    pupils.current.forEach((pupil) => {
      if (!pupil) return;
      pupil.position.x = MathUtils.damp(pupil.position.x, 0.065 + pointer.x * 0.065, 10, dt);
      pupil.position.y = MathUtils.damp(pupil.position.y, -0.01 + pointer.y * 0.06, 10, dt);
    });
    const scale = (hovered ? 1.06 : 1) * (1 - bite * 0.98);
    floating.current.scale.lerp({ x: scale, y: scale, z: scale }, ease);
    floating.current.position.y =
      (1.28 + Math.sin(t * 1.1 + 2) * 0.11 - p * 0.25) * (1 - bite) - bite * 0.3;
    floating.current.position.x = -1.55 * (1 - bite);
    floating.current.position.z = 0.7 + bite * 0.6;
    floating.current.rotation.z = -0.14 + bite * 1.4;
    mouth.current.scale.y = Math.sin(bite * Math.PI) * 0.3 + 0.001;
    mouth.current.visible = bite > 0.04;
    smile.current.visible = bite < 0.1 || bite > 0.93;
    ring.current.rotation.z = t * 0.22 + p;
  });
  return (
    <>
      <ambientLight intensity={1.8} />
      <directionalLight
        position={[3, 6, 5]}
        intensity={3.2}
        castShadow
        shadow-mapSize={[512, 512]}
      />
      <directionalLight position={[-5, 1, 3]} color="#d4caff" intensity={3} />
      <pointLight position={[0, -3, 4]} color="#f3ffbd" intensity={14} />
      <group ref={world} position={[0, 0, 0]}>
        <group position={[0.25, 0, -0.45]} rotation={[0.06, -0.28, 0.13]}>
          <Tile width={3.45} height={2.65} color={palette.purple} depth={0.32} />
          <Tile
            width={3.08}
            height={1.92}
            color="#edebff"
            depth={0.025}
            position={[0, -0.17, 0.41]}
          />
          {[-1.25, -1.01, -0.77].map((x) => (
            <mesh key={x} position={[x, 1.03, 0.43]}>
              <sphereGeometry args={[0.065, 16, 12]} />
              <meshStandardMaterial color="#6c569b" />
            </mesh>
          ))}
          <mesh position={[0.55, 1.03, 0.43]}>
            <boxGeometry args={[1.3, 0.075, 0.025]} />
            <meshStandardMaterial color="#9782ca" />
          </mesh>
        </group>
        <group ref={creature} rotation={[-0.12, -0.12, -0.15]} position={[-0.12, 0, 0.65]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[side * 1.2, -0.42, 0.15]}
              rotation={[0, 0, side * 0.5]}
              scale={[0.2, 0.43, 0.18]}
              castShadow
            >
              <sphereGeometry args={[1, 24, 16]} />
              <meshPhysicalMaterial
                color={palette.acid}
                roughness={0.29}
                metalness={0.08}
                clearcoat={0.5}
              />
            </mesh>
          ))}
          <Tile width={2.35} height={2} color={palette.acid} depth={0.3} position={[0, 0, 0.18]} />
          {[-0.48, 0.38].map((x, i) => (
            <group key={x} position={[x, 0.17, 0.62]}>
              <mesh scale={[0.32, 0.45, 0.15]}>
                <sphereGeometry args={[1, 32, 24]} />
                <meshStandardMaterial color="#fffef3" roughness={0.35} />
              </mesh>
              <mesh
                ref={(mesh) => {
                  pupils.current[i] = mesh;
                }}
                position={[0.085, -0.01, 0.14]}
                scale={[0.12, 0.22, 0.06]}
              >
                <sphereGeometry args={[1, 24, 16]} />
                <meshStandardMaterial color="#202324" roughness={0.2} />
              </mesh>
            </group>
          ))}
          <mesh ref={smile} position={[-0.02, -0.37, 0.61]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.25, 0.035, 12, 32, Math.PI]} />
            <meshStandardMaterial color="#24252a" />
          </mesh>
          <mesh
            ref={mouth}
            position={[-0.02, -0.38, 0.62]}
            scale={[0.35, 0.001, 0.03]}
            visible={false}
          >
            <sphereGeometry args={[1, 24, 16]} />
            <meshBasicMaterial color="#24252a" />
          </mesh>
        </group>
        <group
          ref={floating}
          position={[-1.55, 1.28, 0.7]}
          rotation={[0.02, 0.18, -0.14]}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(product);
          }}
        >
          <Tile width={2.25} height={1.28} color="#fffdf5" depth={0.08} />
          <ProductLabel product={product} position={[0, 0.05, 0.17]} />
          <mesh position={[-0.88, 0.4, 0.18]}>
            <sphereGeometry args={[0.055, 16, 12]} />
            <meshBasicMaterial color="#ff734f" />
          </mesh>
        </group>
        <group ref={ring} position={[2, 1.45, 0.2]} rotation={[0.6, -0.4, 0.2]}>
          <mesh>
            <torusGeometry args={[0.51, 0.17, 24, 48]} />
            <meshPhysicalMaterial color={palette.accent} roughness={0.24} clearcoat={1} />
          </mesh>
        </group>
        <group position={[-2.02, -1.2, 0.2]} rotation={[0.4, 0.2, 0.3]}>
          {[0, Math.PI / 3, (Math.PI * 2) / 3].map((r) => (
            <mesh key={r} rotation={[0, 0, r]}>
              <capsuleGeometry args={[0.15, 0.83, 8, 16]} />
              <meshPhysicalMaterial
                color="#a1b9f5"
                roughness={0.3}
                metalness={0.18}
                clearcoat={1}
              />
            </mesh>
          ))}
        </group>
        <mesh position={[-1.5, -1.9, -0.4]} rotation={[0.3, -0.45, -0.3]}>
          <torusGeometry args={[0.38, 0.14, 24, 40]} />
          <meshPhysicalMaterial
            color={palette.purple}
            roughness={0.22}
            metalness={0.25}
            clearcoat={1}
          />
        </mesh>
      </group>
    </>
  );
}

export default function LaunchScene({
  progress,
  gobble,
  active,
  product,
  palette,
  onSelect,
  boops,
  onReady,
  onFailure,
}) {
  const canvasElement = useRef(null);
  useEffect(
    () => () => canvasElement.current?.removeEventListener('webglcontextlost', onFailure),
    [onFailure],
  );
  return (
    <Canvas
      camera={{ position: [0, 0, 9], fov: 38 }}
      dpr={[1, 1.5]}
      frameloop={active ? 'always' : 'demand'}
      shadows={{ type: PCFShadowMap }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => {
        canvasElement.current = gl.domElement;
        gl.domElement.addEventListener('webglcontextlost', onFailure, { once: true });
        onReady();
      }}
      fallback={null}
      style={{ touchAction: 'pan-y' }}
    >
      <World
        progress={progress}
        gobble={gobble}
        active={active}
        product={product}
        palette={palette}
        onSelect={onSelect}
        boops={boops}
      />
    </Canvas>
  );
}
