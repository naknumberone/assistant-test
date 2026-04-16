import Chat from '@/components/chat';

export default async function Page(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  return <Chat id={id} />;
}
