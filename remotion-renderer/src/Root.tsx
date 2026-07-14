import { Composition, getInputProps } from 'remotion';
import { LyricVideo } from './LyricVideo';

export const RemotionRoot: React.FC = () => {
  const props = (getInputProps() || {}) as { durationInFrames?: number };
  const durationInFrames = props.durationInFrames ? Number(props.durationInFrames) : 1800;
  
  return (
    <>
      <Composition
        id="LyricVideo"
        component={LyricVideo}
        durationInFrames={durationInFrames}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioUrl: '',
          bgUrl: '',
          lyrics: [],
          theme: 'dark',
          lyricPreset: 'line-pop',
          showIntro: false,
          songTitle: ''
        }}
      />
    </>
  );
};
