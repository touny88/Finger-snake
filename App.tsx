import React from 'react';
import SnakeGame from './components/SnakeGame';

const App: React.FC = () => {
  return (
    <div className="w-screen h-screen bg-slate-900">
      <SnakeGame />
    </div>
  );
};

export default App;
