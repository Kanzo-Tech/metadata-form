import { Button, Kbd } from "@radix-ui/themes";

/** A view toggle button with a keyboard-shortcut hint (Source / Output). */
export function Toggle(props: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  kbd: string;
  children: React.ReactNode;
}) {
  return (
    <Button variant="soft" color={props.on ? undefined : "gray"} onClick={props.onClick}>
      {props.icon}
      {props.children}
      <Kbd size="1">{props.kbd}</Kbd>
    </Button>
  );
}
