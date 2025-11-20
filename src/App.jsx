import { AppLayout } from "./components/layout/AppLayout";
import { BlockEditorPane } from "./components/editor/BlockEditorPane";
import { RunPane } from "./components/run/RunPane";
import { BlockPalettePane } from "./components/editor/BlockPalettePane";

function App() {
  return (
    <AppLayout
      editor={<BlockEditorPane />}
      output={<RunPane />}
      palette={<BlockPalettePane />}
    />
  );
}

export default App;
