/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Button, Switch, Text, View } from 'react-native';
import Snackbar from 'react-native-snackbar';
import styles from './styles';
import {
  type MapViewController,
  type NavigationViewController,
  type Marker,
  type NavigationViewCallbacks,
  type MapViewCallbacks,
  type Polygon,
  type Circle,
  type Polyline,
  type LatLng,
  type NavigationCallbacks,
  useNavigation as useNavigationSDK,
  NavigationInitErrorCode,
  RouteStatus,
  type ArrivalEvent,
  type Location,
  type Waypoint,
  type RoutingOptions,
} from '@googlemaps/react-native-navigation-sdk';
import usePermissions from './checkPermissions';
import MapsControls from './mapsControls';
import NavigationControls from './navigationControls';
import OverlayModal from './overlayModal';
import { NavigationView } from '../../src/navigation/navigationView/navigationView';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

// Utility function for showing Snackbar
const showSnackbar = (text: string, duration = Snackbar.LENGTH_SHORT) => {
  Snackbar.show({ text, duration });
};

enum OverlayType {
  None = 'None',
  NavControls = 'NavControls',
  MapControls = 'MapControls',
}

const marginAmount = 50;

const NavigationScreen = () => {
  const { arePermissionsApproved } = usePermissions();
  const [overlayType, setOverlayType] = useState<OverlayType>(OverlayType.None);
  const [mapViewController, setMapViewController] =
    useState<MapViewController | null>(null);
  const [navigationViewController, setNavigationViewController] =
    useState<NavigationViewController | null>(null);

  const { navigationController, addListeners, removeListeners } =
    useNavigationSDK();

  const [navigationInitialized, setNavigationInitialized] = useState(false);
  const [displayMap, setDisplayMap] = useState<boolean>(false);

  const onRouteChanged = useCallback(() => {
    showSnackbar('Route Changed');
  }, []);

  const [margin, setMargin] = useState<number | null>(null);

  const navigation = useNavigation();

  const cleanUpNavigation = useCallback(async () => {
    mapViewController?.clearMapView();
    await navigationController.clearDestinations();
    await navigationController.cleanup();
  }, [mapViewController, navigationController]);

  const moveCameraToStartingSpot = useCallback(async () => {
    console.log('Ryan - moveCameraToStartingSpot');
    if (mapViewController) {
      console.log('Ryan - moveCameraToStartingSpot - mapViewController');
      try {
        await mapViewController.moveCamera({
          target: {
            lat: 32.8271135,
            lng: -96.830288,
          },
          zoom: 10,
          bearing: 0,
          tilt: 0,
        });
      } catch (error) {
        console.error('Error moving camera', error);
        showSnackbar('Error moving camera');
      }
    }
  }, [mapViewController]);

  useFocusEffect(
    React.useCallback(() => {
      setDisplayMap(true);

      return navigation.addListener('blur', async () => {
        setDisplayMap(false);
        await cleanUpNavigation();
      });
    }, [cleanUpNavigation, navigation])
  );

  const onArrival = useCallback(
    (event: ArrivalEvent) => {
      if (event.isFinalDestination) {
        console.log('Final destination reached');
        navigationController.stopGuidance();
      } else {
        console.log('Continuing to the next destination');
        navigationController.continueToNextDestination();
        navigationController.startGuidance();
      }

      showSnackbar('Arrived');
    },
    [navigationController]
  );

  const onTrafficUpdated = useCallback(() => {
    showSnackbar('Traffic Updated');
  }, []);

  const createWayPoints = useCallback(
    async (wayPoints: { lat: number; lng: number }[]) => {
      for (const wayPoint of wayPoints) {
        await mapViewController?.addMarker({
          position: wayPoint,
          visible: true,
        });
      }
    },
    [mapViewController]
  );

  const onNavigationReady = useCallback(async () => {
    const wayPoints = [
      { lat: 32.78889, lng: -96.906553 },
      { lat: 32.7215158, lng: -96.8094594 },
      { lat: 32.709446, lng: -96.746567 },
      { lat: 32.842525, lng: -96.810209 },
      { lat: 32.770895, lng: -96.697785 },
      { lat: 32.793867, lng: -96.767341 },
      { lat: 32.854362, lng: -96.744946 },
      { lat: 32.845018, lng: -96.808388 },
      { lat: 32.925, lng: -96.846349 },
      { lat: 32.901702, lng: -96.982005 },
      { lat: 32.778306, lng: -96.697305 },
      { lat: 32.7449539, lng: -96.8513408 },
      { lat: 32.7852848, lng: -96.8186504 },
    ];
    console.log('onNavigationReady');
    setNavigationInitialized(true);
    await moveCameraToStartingSpot();

    const destinations: Waypoint[] = wayPoints.map(wayPoint => ({
      position: {
        lat: wayPoint.lat,
        lng: wayPoint.lng,
      },
    }));

    const routingOptions: RoutingOptions = {
      travelMode: 0,
      alternateRoutesStrategy: 1,
      avoidFerries: true,
      avoidTolls: false,
    };

    try {
      await navigationController.setDestinations(destinations, routingOptions);
    } catch (error) {
      console.error('Error setting destinations', error);
      showSnackbar('Error setting destinations');
    }

    await createWayPoints(wayPoints);
  }, [moveCameraToStartingSpot]);

  const onNavigationDispose = useCallback(async () => {
    await navigationViewController?.setNavigationUIEnabled(false);
    setNavigationInitialized(false);
  }, [navigationViewController]);

  const onNavigationInitError = useCallback(
    (errorCode: NavigationInitErrorCode) => {
      showSnackbar(`Failed to initialize navigation errorCode: ${errorCode}`);
    },
    []
  );

  const onStartGuidance = useCallback(() => {
    showSnackbar('Start Guidance');
  }, []);

  const onRouteStatusOk = useCallback(async () => {
    showSnackbar('Route created');
    await moveCameraToStartingSpot();
  }, [moveCameraToStartingSpot]);

  const onRouteCancelled = useCallback(() => {
    showSnackbar('Error: Route Cancelled');
  }, []);

  const onNoRouteFound = useCallback(() => {
    showSnackbar('Error: No Route Found');
  }, []);

  const onNetworkError = useCallback(() => {
    showSnackbar('Error: Network Error');
  }, []);

  const onStartingGuidanceError = useCallback(() => {
    showSnackbar('Error: Starting Guidance Error');
  }, []);

  const onLocationDisabled = useCallback(() => {
    showSnackbar('Error: Location Disabled');
  }, []);

  const onLocationUnknown = useCallback(() => {
    showSnackbar('Error: Location Unknown');
  }, []);

  const onLocationChanged = useCallback((location: Location) => {
    console.log('onLocationChanged:', location);
  }, []);

  const onRawLocationChanged = useCallback((location: Location) => {
    console.log('onRawLocationChanged:', location);
  }, []);

  const onTurnByTurn = useCallback((turnByTurn: any) => {
    console.log('onTurnByTurn:', turnByTurn);
  }, []);

  const onRemainingTimeOrDistanceChanged = useCallback(async () => {
    if (navigationController) {
      const currentTimeAndDistance =
        await navigationController.getCurrentTimeAndDistance();
      console.log(currentTimeAndDistance);
    }
    console.log('called onRemainingTimeOrDistanceChanged');
  }, [navigationController]);

  const onRouteStatusResult = useCallback(
    (routeStatus: RouteStatus) => {
      switch (routeStatus) {
        case RouteStatus.OK:
          onRouteStatusOk();
          break;
        case RouteStatus.ROUTE_CANCELED:
          onRouteCancelled();
          break;
        case RouteStatus.NO_ROUTE_FOUND:
          onNoRouteFound();
          break;
        case RouteStatus.NETWORK_ERROR:
          onNetworkError();
          break;
        case RouteStatus.LOCATION_DISABLED:
          onLocationDisabled();
          break;
        case RouteStatus.LOCATION_UNKNOWN:
          onLocationUnknown();
          break;
        default:
          console.log('routeStatus: ' + routeStatus);
          onStartingGuidanceError();
      }
    },
    [
      onRouteStatusOk,
      onRouteCancelled,
      onNoRouteFound,
      onNetworkError,
      onLocationDisabled,
      onLocationUnknown,
      onStartingGuidanceError,
    ]
  );

  const navigationCallbacks: NavigationCallbacks = useMemo(
    () => ({
      onRouteChanged,
      onArrival,
      onNavigationReady,
      onNavigationInitError,
      onLocationChanged,
      onRawLocationChanged,
      onTrafficUpdated,
      onRouteStatusResult,
      onStartGuidance,
      onRemainingTimeOrDistanceChanged,
      onTurnByTurn,
    }),
    [
      onRouteChanged,
      onArrival,
      onNavigationReady,
      onNavigationInitError,
      onLocationChanged,
      onRawLocationChanged,
      onTrafficUpdated,
      onRouteStatusResult,
      onStartGuidance,
      onRemainingTimeOrDistanceChanged,
      onTurnByTurn,
    ]
  );

  useEffect(() => {
    addListeners(navigationCallbacks);
    return () => {
      removeListeners(navigationCallbacks);
    };
  }, [navigationCallbacks, addListeners, removeListeners]);

  const onMapReady = useCallback(async () => {
    console.log('Map is ready, initializing navigator...');
    try {
      await navigationController.init();
      mapViewController?.setMyLocationEnabled(true);
    } catch (error) {
      console.error('Error initializing navigator', error);
      showSnackbar('Error initializing navigator');
    }
  }, [mapViewController, navigationController]);

  const onRecenterButtonClick = useCallback(async () => {
    console.log('onRecenterButtonClick');
    await moveCameraToStartingSpot();
  }, [moveCameraToStartingSpot]);

  const onShowNavControlsClick = useCallback(() => {
    setOverlayType(OverlayType.NavControls);
  }, [setOverlayType]);

  const onShowMapsControlsClick = useCallback(() => {
    setOverlayType(OverlayType.MapControls);
  }, [setOverlayType]);

  const navigationViewCallbacks: NavigationViewCallbacks = {
    onRecenterButtonClick,
  };

  const mapViewCallbacks: MapViewCallbacks = useMemo(() => {
    return {
      onMapReady,
      onMarkerClick: (marker: Marker) => {
        console.log('onMarkerClick:', marker);
      },
      onPolygonClick: (polygon: Polygon) => {
        console.log('onPolygonClick:', polygon);
        mapViewController?.removePolygon(polygon.id);
      },
      onCircleClick: (circle: Circle) => {
        console.log('onCircleClick:', circle);
        mapViewController?.removeCircle(circle.id);
      },
      onPolylineClick: (polyline: Polyline) => {
        console.log('onPolylineClick:', polyline);
        mapViewController?.removePolyline(polyline.id);
      },
      onMarkerInfoWindowTapped: (marker: Marker) => {
        console.log('onMarkerInfoWindowTapped:', marker);
      },
      onMapClick: (latLng: LatLng) => {
        console.log('onMapClick:', latLng);
      },
    };
  }, [mapViewController, onMapReady]);

  const closeOverlay = (): void => {
    setOverlayType(OverlayType.None);
  };

  return arePermissionsApproved && displayMap ? (
    <View style={[styles.container]}>
      <NavigationView
        style={[
          {
            ...styles.map_view,
            margin: margin,
          },
        ]}
        androidStylingOptions={{
          primaryDayModeThemeColor: '#34eba8',
          headerDistanceValueTextColor: '#76b5c5',
          headerInstructionsFirstRowTextSize: '20f',
        }}
        iOSStylingOptions={{
          navigationHeaderPrimaryBackgroundColor: '#34eba8',
          navigationHeaderDistanceValueTextColor: '#76b5c5',
        }}
        navigationViewCallbacks={navigationViewCallbacks}
        mapViewCallbacks={mapViewCallbacks}
        onMapViewControllerCreated={setMapViewController}
        onNavigationViewControllerCreated={setNavigationViewController}
      />

      {navigationViewController != null &&
        navigationController != null &&
        navigationInitialized && (
          <OverlayModal
            visible={overlayType === OverlayType.NavControls}
            closeOverlay={closeOverlay}
          >
            <NavigationControls
              navigationController={navigationController}
              navigationViewController={navigationViewController}
              getCameraPosition={mapViewController?.getCameraPosition}
              onNavigationDispose={onNavigationDispose}
            />
          </OverlayModal>
        )}

      {mapViewController != null && (
        <OverlayModal
          visible={overlayType === OverlayType.MapControls}
          closeOverlay={closeOverlay}
        >
          <MapsControls mapViewController={mapViewController} />
        </OverlayModal>
      )}

      <View style={styles.controlButtons}>
        <Button
          title="Navigation"
          onPress={onShowNavControlsClick}
          disabled={!navigationInitialized}
        />
        <Button title="Maps" onPress={onShowMapsControlsClick} />
        <View style={styles.rowContainer}>
          <Text>Margin</Text>
          <Switch
            value={!!margin}
            onValueChange={() => {
              setMargin(margin ? null : marginAmount);
            }}
          />
        </View>
      </View>
    </View>
  ) : (
    <React.Fragment />
  );
};

export default NavigationScreen;
