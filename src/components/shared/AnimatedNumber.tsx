import React from 'react';
import CountUp from 'react-countup';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  preserveValue?: boolean;
  start?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 2,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  preserveValue = false,
  start = 0
}) => {
  return (
    <CountUp
      start={start}
      end={value}
      duration={duration}
      decimals={decimals}
      prefix={prefix}
      suffix={suffix}
      preserveValue={preserveValue}
      className={className}
      separator=" "
      decimal=","
    />
  );
};

export default AnimatedNumber;