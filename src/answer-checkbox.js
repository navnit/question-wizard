// Shared print geometry: a 12pt square with a 1pt black border.
export const CHECKBOX_SIZE = 12;
export const CHECKBOX_STROKE = 1;
// Transparent 96px PNG keeps Word output independent of symbol fonts.
export const checkboxPng = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAABAUlEQVR4nO3RsQnAQBADwe+/absEB4+ZQDug7IKDPeecp9HxB9bHH1gff2B9/IH18QfWxx9YH39gfd8HuVIArABYAbACYAXACoAVACsAVgCsAFgBsAJgBcAKgBUAKwBWAKwAWAGwAmAFwAqAFQArAFYArABYAbACYAXACoAVACsAVgCsAFgBsAJgBcAKgBUAKwBWAKwAWAGwAmAFwAqAFQArAFYArABYAbACYAXACoAVACsAVgCsAFgBsAJgBcAKgBUAKwBWAKwAWAGwAmAFwAqAFQArAFYArABYAbACYAXACoAVALsO0P4df2B9/IH18QfWxx9YH39gffyB9fEHpvcCawz1l4FUUzYAAAAASUVORK5CYII="), c => c.charCodeAt(0));
