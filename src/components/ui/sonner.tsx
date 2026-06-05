import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          actionButton:
            "!bg-primary !text-primary-foreground !rounded-lg !text-xs !font-medium",
          cancelButton:
            "!bg-muted !text-muted-foreground !rounded-lg !text-xs !font-medium",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
