import { registerRootComponent } from 'expo';

// Defines the background trip-location task; must load before the app so Android can wake it
import './src/tripTracking';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
