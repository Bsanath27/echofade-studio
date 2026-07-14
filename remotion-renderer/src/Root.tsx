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
          songTitle: '',
          fontFamily: 'Montserrat',
          fontSize: 60,
          fontColor: '#ffffff',
          posX: 50,
          posY: 50,
          textTransform: 'uppercase',
          strokeWidth: 2,
          strokeColor: '#000000',
          shadowOffset: 4,
          lyricStyle: 'single',
          bloomColor: '',
          bloomRadius: 0,
          beatShake: false,
          chromaticAberration: false
        }}
      />
    </>
  );
};
