import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EditEvent from "./pages/EditEvent";
import ScoreInput from "./pages/ScoreInput";
import ScoreSummary from "./pages/ScoreSummary";

function App() {
  return (
    <Router basename="/FlashComp">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/create-event" element={<CreateEvent />} />
        <Route path="/events/:eventId/edit" element={<EditEvent />} />
        <Route path="/events/:eventId/scoreinput/:seasonId/:categoryId/:participantId" element={<ScoreInput />} />
        <Route path="/score-summary" element={<ScoreSummary />} />
      </Routes>
    </Router>
  );
}

export default App;