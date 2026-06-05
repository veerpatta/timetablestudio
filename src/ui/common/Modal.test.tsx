import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "./Modal";

describe("Modal (shared shell)", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Modal onClose={onClose}><p>Body</p></Modal>);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on overlay (backdrop) click but not on content click", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} label="Test dialog">
        <button type="button">Inside</button>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Inside"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
