// /money/connections: linked banks, cards and brokerages. A static route, so it wins over ./[tab].tsx.
import { Stack } from 'expo-router';
import ConnectionsScreen from '../../money/live/ConnectionsScreen';

export default function ConnectionsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Connections', headerBackTitle: 'Back' }} />
      <ConnectionsScreen />
    </>
  );
}
