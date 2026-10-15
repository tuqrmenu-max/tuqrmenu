import { Composition, Folder } from "remotion";
import { HelloWorld } from "./HelloWorld";
import { Logo } from "./HelloWorld/Logo";
import { Title } from "./HelloWorld/Title";
import { FrameA, FrameB } from "./Demo/Scenes";
import { Nivel1 } from "./Demo/Nivel1";
import { Nivel2 } from "./Demo/Nivel2";
import { Nivel3 } from "./Demo/Nivel3";

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Transiciones">
        <Composition
          id="Nivel1-Estandar"
          component={Nivel1}
          durationInFrames={240}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Nivel2-Morphing"
          component={Nivel2}
          durationInFrames={90}
          fps={30}
          width={1920}
          height={1280}
        />
        <Composition
          id="Nivel3-IA"
          component={Nivel3}
          durationInFrames={130}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <Folder name="Frames-fuente">
        <Composition
          id="FrameA"
          component={FrameA}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="FrameB"
          component={FrameB}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
      <Folder name="Elements">
        <Composition
          id="Logo"
          component={Logo}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            logoColor1: "#91EAE4",
            logoColor2: "#86A8E7",
          }}
        />
        <Composition
          id="Title"
          component={Title}
          durationInFrames={115}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{
            titleText: "Welcome to Remotion",
            titleColor: "#000000",
          }}
        />
      </Folder>
      <Composition
        // You can take the "id" to render a video:
        // bunx remotion render HelloWorld
        id="HelloWorld"
        component={HelloWorld}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        // You can override these props for each render:
        // https://www.remotion.dev/docs/parametrized-rendering
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "#000000",
        }}
      />

    </>
  );
};
