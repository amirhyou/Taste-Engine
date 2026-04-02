import { useLocalSearchParams } from 'expo-router';
import { ContestDetailScreen } from '@/src/screens/ContestDetailScreen';

export default function ContestDetailRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ContestDetailScreen contestId={id} />;
}
