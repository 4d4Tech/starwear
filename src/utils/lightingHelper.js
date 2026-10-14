import * as THREE from 'three';

/**
 * Creates a Three.js Group containing active custom lights.
 * Handles Point, Spot, Directional, and Hemisphere lights.
 * Renders glowing visual 3D emitters/bulbs so light sources are physically visible in 3D previews and scenes.
 *
 * @param {Array} lightsList - Array of custom light configurations
 * @param {object} THREE_LIB - Three.js instance
 * @param {object} options - Optional configuration { showVisualBulb: boolean }
 * @returns {THREE.Group|null}
 */
export function createCustomLightsGroup(lightsList, THREE_LIB = THREE, options = {}) {
  const { showVisualBulb = true } = options;
  if (!Array.isArray(lightsList) || lightsList.length === 0) return null;

  const group = new THREE_LIB.Group();
  group.name = 'custom_lights_group';

  lightsList.forEach((item) => {
    if (!item || item.visible === false) return;

    const color = new THREE_LIB.Color(item.color || '#ffffff');
    const intensity = item.intensity !== undefined ? Number(item.intensity) : 2.5;
    let light = null;
    let bulbMesh = null;

    switch (item.type) {
      case 'point': {
        const distance = item.distance !== undefined ? Number(item.distance) : 25;
        const decay = item.decay !== undefined ? Number(item.decay) : 1.5;
        light = new THREE_LIB.PointLight(color, intensity, distance, decay);
        light.position.set(
          Number(item.posX ?? 0),
          Number(item.posY ?? 2),
          Number(item.posZ ?? 2)
        );

        if (showVisualBulb && item.showHelper !== false) {
          const bulbGroup = new THREE_LIB.Group();
          bulbGroup.name = `Bulb_${item.id || 'point'}`;

          // Glowing luminous core
          const coreGeo = new THREE_LIB.SphereGeometry(0.06, 16, 16);
          const coreMat = new THREE_LIB.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 3.0,
            roughness: 0.1,
            metalness: 0.2
          });
          bulbGroup.add(new THREE_LIB.Mesh(coreGeo, coreMat));

          // Soft wireframe halo / aura
          const auraGeo = new THREE_LIB.SphereGeometry(0.09, 12, 12);
          const auraMat = new THREE_LIB.MeshBasicMaterial({
            color: color,
            wireframe: true,
            transparent: true,
            opacity: 0.6
          });
          bulbGroup.add(new THREE_LIB.Mesh(auraGeo, auraMat));

          bulbGroup.position.copy(light.position);
          bulbMesh = bulbGroup;
        }
        break;
      }

      case 'spot': {
        const distance = item.distance !== undefined ? Number(item.distance) : 30;
        const angleRad = ((Number(item.angle || 45)) * Math.PI) / 180;
        const penumbra = item.penumbra !== undefined ? Number(item.penumbra) : 0.35;
        const decay = item.decay !== undefined ? Number(item.decay) : 1.5;
        light = new THREE_LIB.SpotLight(color, intensity, distance, angleRad, penumbra, decay);
        light.position.set(
          Number(item.posX ?? 0),
          Number(item.posY ?? 2.5),
          Number(item.posZ ?? 2)
        );
        light.target.position.set(
          Number(item.targetX ?? 0),
          Number(item.targetY ?? 0),
          Number(item.targetZ ?? 0)
        );
        group.add(light.target);

        if (showVisualBulb && item.showHelper !== false) {
          const coneGeo = new THREE_LIB.ConeGeometry(0.08, 0.16, 16);
          const coneMat = new THREE_LIB.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.5,
            roughness: 0.2,
            metalness: 0.3
          });
          const coneMesh = new THREE_LIB.Mesh(coneGeo, coneMat);
          coneMesh.position.copy(light.position);

          const dir = new THREE_LIB.Vector3().subVectors(light.target.position, light.position).normalize();
          coneMesh.quaternion.setFromUnitVectors(new THREE_LIB.Vector3(0, 1, 0), dir);
          bulbMesh = coneMesh;
        }
        break;
      }

      case 'directional': {
        light = new THREE_LIB.DirectionalLight(color, intensity);
        light.position.set(
          Number(item.posX ?? 1.5),
          Number(item.posY ?? 3),
          Number(item.posZ ?? 2)
        );
        light.target.position.set(
          Number(item.targetX ?? 0),
          Number(item.targetY ?? 0),
          Number(item.targetZ ?? 0)
        );
        group.add(light.target);

        if (showVisualBulb && item.showHelper !== false) {
          const octGeo = new THREE_LIB.OctahedronGeometry(0.08);
          const octMat = new THREE_LIB.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 2.5,
            wireframe: true
          });
          const octMesh = new THREE_LIB.Mesh(octGeo, octMat);
          octMesh.position.copy(light.position);
          bulbMesh = octMesh;
        }
        break;
      }

      case 'hemisphere': {
        const groundColor = new THREE_LIB.Color(item.groundColor || '#1e293b');
        light = new THREE_LIB.HemisphereLight(color, groundColor, intensity);
        light.position.set(
          Number(item.posX ?? 0),
          Number(item.posY ?? 3),
          Number(item.posZ ?? 0)
        );
        break;
      }

      default:
        break;
    }

    if (light) {
      light.name = item.name || `Light - ${item.type || 'Custom'}`;
      light.castShadow = Boolean(item.castShadow);
      light.userData = {
        ...(item || {}),
        isCustomLight: true,
        lightId: item.id
      };
      group.add(light);

      if (bulbMesh) {
        group.add(bulbMesh);
      }
    }
  });

  return group;
}
