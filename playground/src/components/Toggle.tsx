import { Button, Kbd } from "@kanzo-tech/ui";

/** A view toggle button with a keyboard-shortcut hint (Source / Output). */
export function Toggle(props: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  kbd: string;
  children: React.ReactNode;
}) {
  return (
    <Button variant={props.on ? "secondary" : "ghost"} onClick={props.onClick}>
      {props.icon}
      {props.children}
      <Kbd>{props.kbd}</Kbd>
    </Button>
  );
}
