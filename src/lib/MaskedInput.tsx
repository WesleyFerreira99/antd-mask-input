import * as React from 'react';
import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { InputRef } from 'antd';
import Input, { InputProps } from 'antd/lib/input';
import IMask from 'imask';

export interface MaskedInputProps
  extends Omit<InputProps, 'onChange' | 'value' | 'defaultValue'> {
  mask: MaskType;
  definitions?: InputMaskOptions['definitions'];
  value?: string;
  defaultValue?: string;
  maskOptions?: InputMaskOptions;
  onChange?: (event: OnChangeEvent) => any;
}

export { IMask };

export const MaskedInput = React.forwardRef<InputRef, MaskedInputProps>(
  function MaskedInput(props: MaskedInputProps, antdRef) {
    const {
      mask,
      maskOptions: _maskOptions,
      value: _value,
      defaultValue,
      definitions,
      ...antdProps
    } = props;

    const innerRef = useRef<HTMLInputElement | null>(null);

    const maskOptions = useMemo(() => {
      return {
        mask,
        definitions: {
          '0': /[0-9]/,
          ...(typeof _maskOptions?.definitions === 'object' ? _maskOptions.definitions : {}),
          ...definitions,
        },
        lazy: false, // make placeholder always visible
        ...(_maskOptions || {}),
      } as IMask.AnyMaskedOptions;
    }, [mask, _maskOptions, definitions]);

    const placeholder = useMemo(() => {
      return IMask.createPipe({ ...maskOptions, lazy: false })( '');
    }, [maskOptions]);

    const imask = useRef<IMask.InputMask<any> | null>(null);

    const propValue = _value ?? defaultValue ?? '';
    const lastValue = useRef(propValue);

    const [value, setValue] = useState(propValue);

    const _onEvent = useCallback((ev: React.ChangeEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>, execOnChangeCallback = false) => {
      const masked = imask.current;
      if (!masked) return;

      const target = ev.target as HTMLInputElement;
      if (target) {
        if (target.value !== masked.value) {
          masked.value = target.value;
          target.value = masked.value;
          lastValue.current = masked.value;
        }
      }

      Object.assign(ev, {
        maskedValue: masked.value,
        unmaskedValue: masked.unmaskedValue,
      });

      masked.updateValue();
      setValue(lastValue.current);

      if (execOnChangeCallback) {
        props.onChange?.(ev as any);
      }
    }, [props.onChange]);

    const _onAccept = useCallback((ev: any) => {
      if (!ev?.target) return;

      const input = innerRef.current;
      const masked = imask.current;
      if (!input || !masked) return;

      input.value = masked.value;
      lastValue.current = masked.value;

      _onEvent(ev, true);
    }, [_onEvent]);

    function updateMaskRef() {
      const input = innerRef.current;

      if (imask.current) {
        imask.current.updateOptions(maskOptions);
      }

      if (!imask.current && input) {
        imask.current = IMask(input, maskOptions);
        imask.current.on('accept', _onAccept);
      }

      if (imask.current && imask.current.value !== lastValue.current) {
        imask.current.value = lastValue.current;
        imask.current.alignCursor();
      }
    }

    function updateValue(value: string) {
      lastValue.current = value;
      const input = innerRef.current;
      const masked = imask.current;
      if (!(input && masked)) return;
      masked.value = value;
      input.value = masked.value;
      lastValue.current = masked.value;
    }

    useEffect(() => {
      updateMaskRef();

      return () => {
        imask.current?.destroy();
        imask.current = null;
      };
    }, [maskOptions, _onAccept]);

    useEffect(() => {
      updateValue(propValue);
    }, [propValue]);

    const eventHandlers = useMemo(() => {
      return {
        onBlur(ev: React.FocusEvent<HTMLInputElement>) {
          _onEvent(ev);
          props.onBlur?.(ev);
        },

        onPaste(ev: React.ClipboardEvent<HTMLInputElement>) {
          lastValue.current = ev.clipboardData?.getData('text') || '';

          if (ev.target) {
            const target = ev.target as HTMLInputElement;
            target.value = lastValue.current;
          }

          _onEvent(ev as any, true);
          props.onPaste?.(ev);
        },

        onFocus(ev: React.FocusEvent<HTMLInputElement>) {
          _onEvent(ev);
          props.onFocus?.(ev);
        },

        [KEY_PRESS_EVENT]: (ev: React.KeyboardEvent<HTMLInputElement>) => {
          _onEvent(ev as any, true);
          props[KEY_PRESS_EVENT]?.(ev);
        },
      };
    }, [_onEvent]);

    return (
      <Input
        placeholder={placeholder}
        {...antdProps}
        {...eventHandlers}
        onChange={(ev) => _onEvent(ev as any, true)}
        value={value}
        ref={(ref) => {
          if (antdRef) {
            if (typeof antdRef === 'function') {
              antdRef(ref);
            } else {
              antdRef.current = ref;
            }
          }

          if (ref?.input) {
            innerRef.current = ref.input;
            if (!imask.current) {
              updateMaskRef();
            }
          }
        }}
      />
    );
  }
);

function keyPressPropName() {
  if (typeof navigator !== 'undefined') {
    return navigator.userAgent.match(/Android/i)
      ? 'onBeforeInput'
      : 'onKeyPress';
  }
  return 'onKeyPress';
}

const KEY_PRESS_EVENT = keyPressPropName();

export default MaskedInput;

export type UnionToIntersection<T> = (
  T extends any ? (x: T) => any : never
) extends (x: infer R) => any
  ? {
      [K in keyof R]: R[K];
    }
  : never;

type OnChangeParam = Parameters<Exclude<InputProps['onChange'], undefined>>[0];

interface OnChangeEvent extends OnChangeParam {
  maskedValue: string;
  unmaskedValue: string;
}

interface IMaskOptionsBase
  extends UnionToIntersection<IMask.AnyMaskedOptions> {}

export type InputMaskOptions = {
  [K in keyof IMaskOptionsBase]?: IMaskOptionsBase[K];
};

type MaskFieldType = string | RegExp | Function | Date | InputMaskOptions;

interface IMaskOptions extends Omit<InputMaskOptions, 'mask'> {
  mask: MaskFieldType;
}

interface MaskOptionsList extends Array<IMaskOptions> {}

export type MaskType = MaskFieldType | MaskOptionsList;
