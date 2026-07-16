import { Composition, getInputProps } from 'remotion';
import { LyricVideo } from './LyricVideo';

export const RemotionRoot: React.FC = () => {
  const props = (getInputProps() || {}) as { durationInFrames?: number; width?: number; height?: number };
  const durationInFrames = props.durationInFrames ? Number(props.durationInFrames) : 1800;
  const width = props.width ? Number(props.width) : 1920;
  const height = props.height ? Number(props.height) : 1080;
  
  return (
    <>
      <Composition
        id="LyricVideo"
        component={LyricVideo}
        durationInFrames={durationInFrames}
        fps={30}
        width={width}
        height={height}
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
          chromaticAberration: false,
          bgMode: 'image',
          bgBlur: 0,
          bgDim: 0,
          gradientColors: null,
          grain: 0,
          vignetteStrength: 0,
          maskSubject: false,
          subjectImageUrl: '',
          overlayUrl: '',
          overlayOpacity: 0.4,
          overlayMode: 'screen'
        }}
      />
    </>
  );
};
