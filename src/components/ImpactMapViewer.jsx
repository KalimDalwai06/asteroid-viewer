import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function ImpactMapViewer() {
  const mapRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef(null); // store viewer globally for the log button

  useEffect(() => {
    let viewer;

    async function initCesium() {
      Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2ODBjMDkxMy1lMTlhLTQwYjgtOTU1Mi0yODkyN2QyNWQ3NTkiLCJpZCI6MzQ3Mzk3LCJpYXQiOjE3NTk2NjE1NzZ9.7VuUELwF6iDM5JpESAc60LMiSAqUqHVee1B94RxHVXA";

      viewer = new Cesium.Viewer(mapRef.current, {
        animation: false,
        baseLayerPicker: false,
        geocoder: false,
        timeline: false,
        sceneModePicker: false,
        navigationHelpButton: true,
        homeButton: true,
        fullscreenButton: false,
        terrainProvider: await Cesium.CesiumTerrainProvider.fromIonAssetId(1),
      });

      viewerRef.current = viewer;

      // ✅ Add Google Satellite imagery
      const imageryProvider = await Cesium.IonImageryProvider.fromAssetId(3830182);
      const imageryLayer = new Cesium.ImageryLayer(imageryProvider);
      viewer.imageryLayers.add(imageryLayer);

      // ✅ Fly to Earth (global view) on initial load
      const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
        (remaining) => {
          if (remaining === 0) {
            viewer.scene.camera.flyHome(2.0);
            setTimeout(() => setIsLoading(false), 800);
            removeListener();
          }
        }
      );
      setTimeout(() => setIsLoading(false), 8000); // fallback

      // ✅ Remove zoom restrictions
      const ctrl = viewer.scene.screenSpaceCameraController;
      ctrl.enableRotate = true;
      ctrl.enableZoom = true;
      ctrl.enableTilt = true;
      ctrl.enableLook = true;
      ctrl.minimumZoomDistance = 1; // practically no restriction
      ctrl.maximumZoomDistance = 50000000; // 50,000 km (very far out if needed)

      // ---------------------------
      // LONG PRESS + IMPACT CIRCLES
      // ---------------------------
      let mouseDownTime = null;
      let clickPosition = null;
      let circles = [];

      function clearCircles() {
        circles.forEach((c) => viewer.entities.remove(c));
        circles = [];
      }

      function drawImpactCircles(position) {
        clearCircles();
        const radii = [500, 1000, 2000];
        const colors = [
          Cesium.Color.RED.withAlpha(0.5),
          Cesium.Color.RED.withAlpha(0.3),
          Cesium.Color.RED.withAlpha(0.15),
        ];
        radii.forEach((radius, i) => {
          const entity = viewer.entities.add({
            position,
            ellipse: {
              semiMajorAxis: radius,
              semiMinorAxis: radius,
              material: colors[i],
              height: 0,
            },
          });
          circles.push(entity);
        });
      }

      const handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

      handler.setInputAction((click) => {
        mouseDownTime = Date.now();
        clickPosition = click.position;
      }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

      handler.setInputAction(() => {
        if (mouseDownTime) {
          const pressDuration = Date.now() - mouseDownTime;
          if (pressDuration > 500) {
            const pickedRay = viewer.camera.getPickRay(clickPosition);
            const cartesian = viewer.scene.globe.pick(pickedRay, viewer.scene);

            if (cartesian) {
              const carto = Cesium.Cartographic.fromCartesian(cartesian);
              const lon = Cesium.Math.toDegrees(carto.longitude);
              const lat = Cesium.Math.toDegrees(carto.latitude);

              console.log("📍 Long press location:", { lon, lat });

              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lon, lat, 250000),
                orientation: {
                  heading: viewer.camera.heading,
                  pitch: Cesium.Math.toRadians(-70),
                  roll: 0.0,
                },
                duration: 1.8,
                complete: () => {
                  drawImpactCircles(cartesian);
                  logCameraDetails(viewer, "📸 After long press flyTo");
                },
              });
            }
          }
        }
        mouseDownTime = null;
        clickPosition = null;
      }, Cesium.ScreenSpaceEventType.LEFT_UP);

      handler.setInputAction(() => {
        mouseDownTime = null;
        clickPosition = null;
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    initCesium();

    return () => {
      if (viewer) viewer.destroy();
    };
  }, []);

  // ✅ Utility: Log current camera info
  const logCameraDetails = (viewer, label = "📸 Camera details") => {
    if (!viewer) return;
    const cam = viewer.camera;
    const pos = cam.positionCartographic;

    console.log(`\n${label}`);
    console.log("-----------------------------");
    console.log("Longitude:", Cesium.Math.toDegrees(pos.longitude));
    console.log("Latitude :", Cesium.Math.toDegrees(pos.latitude));
    console.log("Height   :", pos.height);
    console.log("Heading  :", cam.heading);
    console.log("Pitch    :", cam.pitch);
    console.log("Roll     :", cam.roll);
    console.log("-----------------------------");
  };

  // ✅ On button click, log camera position & orientation
  const handleLogButtonClick = () => {
    if (viewerRef.current) {
      logCameraDetails(viewerRef.current, "📍 Current camera settings");
    }
  };

  return (
    <section className="w-full flex flex-col items-center mt-20 px-4">
      <div className="w-full max-w-6xl bg-slate-900 border border-slate-700 rounded-2xl shadow-xl overflow-hidden relative">
        <h2 className="text-3xl text-center text-white py-6 border-b border-slate-700">
          Impact Zone Simulator
        </h2>

        {/* Map container */}
        <div
          ref={mapRef}
          className="w-full h-[600px] rounded-b-2xl"
          style={{ overflow: "hidden" }}
        />

        {/* ✅ Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white text-xl font-semibold">
            🌍 Loading Earth...
          </div>
        )}
      </div>

      {/* ✅ Button to log current camera settings */}
      <button
        onClick={handleLogButtonClick}
        className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition"
      >
        📐 Log Current Camera View
      </button>
    </section>
  );
}
