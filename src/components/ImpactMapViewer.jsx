import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

export default function ImpactMapViewer() {
  const mapRef = useRef(null);

  useEffect(() => {
    // Initialize Cesium viewer
    Cesium.Ion.defaultAccessToken = "jNJuG3IzdIOdivBcMTOQgmWxbtJhyD52FsRQsgPN";

    const viewer = new Cesium.Viewer(mapRef.current, {
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      timeline: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      homeButton: false,
      fullscreenButton: false,
      terrainProvider: Cesium.CesiumTerrainProvider.fromIonAssetId(1),
    });

    // Load a base imagery layer
    const layer = Cesium.ImageryLayer.fromProviderAsync(
      Cesium.IonImageryProvider.fromAssetId(3830186) // Google Maps 2D Contour
    );
    viewer.imageryLayers.add(layer);

    // Default camera location (Philly)
    viewer.scene.camera.flyTo({
      duration: 0,
      destination: Cesium.Rectangle.fromDegrees(
        -75.280266,
        39.867004,
        -74.955763,
        40.137992
      ),
    });

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

      const radii = [500, 1000, 2000]; // meters
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
            const cameraHeight = viewer.scene.camera.positionCartographic.height;

            if (cameraHeight > 5000) {
              viewer.camera.flyTo({
                destination: cartesian,
                orientation: {
                  heading: viewer.camera.heading,
                  pitch: Cesium.Math.toRadians(-45),
                  roll: 0.0,
                },
                duration: 1.5,
                complete: () => drawImpactCircles(cartesian),
              });
            } else {
              drawImpactCircles(cartesian);
            }
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

    return () => {
      handler.destroy();
      viewer.destroy();
    };
  }, []);

  return (
    <div className="w-full h-[80vh] bg-black border-t border-slate-700 mt-20">
      <h2 className="text-3xl text-center text-white py-6">
        Impact Zone Simulator
      </h2>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}
