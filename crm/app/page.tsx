import { redirect } from "next/navigation";

export default function Home() {
  // Make the sign-in screen the public entry point instead of sending visitors
  // straight to the dashboard before they have authenticated.
  redirect("/login");
}
