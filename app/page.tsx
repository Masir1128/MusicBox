export default async function Home() {
  if (process.env.NEXT_PUBLIC_ONLINE_DEMO === "1") {
    const { default: OnlineDemo } = await import("./online-demo");
    return <OnlineDemo />;
  }

  const { default: CreatorStudio } = await import("./creator-studio");
  return <CreatorStudio />;
}
