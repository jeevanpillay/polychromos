import type {
  PolychromosElement,
  PolychromosWorkspace,
} from "@polychromos/types";

import { Box } from "./element-renderers/box";
import { Image } from "./element-renderers/image";
import { Text } from "./element-renderers/text";
import { WebGL } from "./element-renderers/webgl";

interface RendererProps {
  element: PolychromosElement;
  tokens?: PolychromosWorkspace["tokens"];
}

export function Renderer({ element, tokens }: RendererProps) {
  switch (element.type) {
    case "box":
      return <Box element={element} tokens={tokens} />;
    case "text":
      return <Text element={element} _tokens={tokens} />;
    case "image":
      return <Image element={element} _tokens={tokens} />;
    case "webgl":
      return <WebGL element={element} _tokens={tokens} />;
    default:
      return null;
  }
}
