
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './views/Home';
import Broadcaster from './views/Broadcaster';
import Viewer from './views/Viewer';

const App: React.FC = () => {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-white font-sans overflow-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/broadcast" element={<Broadcaster />} />
          <Route path="/view/:roomCode" element={<Viewer />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
