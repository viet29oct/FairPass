import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import Home from "./pages/Home";
import EventDetail from "./pages/EventDetail";
import MyTickets from "./pages/MyTickets";
import Marketplace from "./pages/Marketplace";
import Organizer from "./pages/Organizer";
import OrganizerNew from "./pages/OrganizerNew";
import OrganizerEvent from "./pages/OrganizerEvent";
import CheckIn from "./pages/CheckIn";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import RouteError from "./pages/RouteError";

export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/events/:id", element: <EventDetail /> },
      { path: "/my-tickets", element: <MyTickets /> },
      { path: "/marketplace", element: <Marketplace /> },
      { path: "/organizer", element: <Organizer /> },
      { path: "/organizer/new", element: <OrganizerNew /> },
      { path: "/organizer/events/:id", element: <OrganizerEvent /> },
      { path: "/checkin", element: <CheckIn /> },
      { path: "/admin", element: <Admin /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
