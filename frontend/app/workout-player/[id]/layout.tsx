import { GifProvider } from './context/GifContext';

export default function WorkoutPlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GifProvider>
      {children}
    </GifProvider>
  );
} 