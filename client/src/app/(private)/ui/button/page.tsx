"use client";

import { Button } from "@/components/ui/cverify/Button";
import { File } from "lucide-react";

import { Google } from '@thesvg/react';

export default function UIButtonDemoPage() {
    return (
        <div className="flex flex-col gap-6 items-center justify-center p-10">
            <h1 className="text-2xl font-bold mb-4">Button Component Showcase</h1>

            {/* 1. Variants */}
            <div className="flex flex-col gap-2 items-center border border-border p-6 rounded-xl w-full max-w-4xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Button Variants</span>
                <div className="flex flex-wrap gap-2 justify-center">
                    <Button>Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="tertiary">Tertiary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="danger">Danger</Button>
                    <Button variant="danger-soft">Danger Soft</Button>
                </div>
            </div>

            {/* 2. Icons */}
            <div className="flex flex-col gap-2 items-center border border-border p-6 rounded-xl w-full max-w-4xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Icons Integration</span>
                <div className="flex flex-wrap gap-2 justify-center">
                    <Button>With Icon <File /></Button>
                    <Button variant="secondary"><File /> With Icon</Button>
                    <Button variant="tertiary"><File /> Both Icons <File /></Button>
                    <Button isIconOnly><File /></Button>
                    <Button variant="tertiary"><Google /> Continue with Google</Button>
                </div>
            </div>

            {/* 3. Sizes */}
            <div className="flex flex-col gap-2 items-center border border-border p-6 rounded-xl w-full max-w-4xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Custom Sizes (XS to XL)</span>
                <div className="flex flex-wrap gap-3 items-center justify-center">
                    <Button size="xs"><File />XS Size</Button>
                    <Button size="sm"><File />Small</Button>
                    <Button size="md"><File />Medium</Button>
                    <Button size="lg"><File />Large</Button>
                    <Button size="xl"><File />Extra Large</Button>
                </div>
            </div>

            {/* 5. States */}
            <div className="flex flex-col gap-2 items-center border border-border p-6 rounded-xl w-full max-w-4xl">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Disabled States</span>
                <div className="flex flex-wrap gap-2 justify-center">
                    <Button isDisabled>Is Disabled (HeroUI property)</Button>
                    <Button disabled>Disabled (Native HTML property)</Button>
                    <Button isPending>Pending</Button>
                </div>
            </div>
        </div>
    );
}